/**
 * Public search endpoint for the imported debate-card corpus.
 *
 * The admin Parquet importer writes normalized rows to `debate_cards`.  This
 * route is deliberately the other half of that feature: `/research/cards` reads those
 * rows directly instead of falling back to a separate in-memory demo corpus.
 *
 * The query building and row mapping live in `@/lib/search/debate-card-search`
 * so the SQL this issues is unit tested against a real SQLite database — the
 * route's catch-all turns a malformed query into an empty result list rather
 * than an error, which is exactly how a broken `where` clause hid here before.
 *
 * Card text is matched through the FTS5 index in `@/lib/search/card-fts` and
 * ranked by BM25: quoted phrases must match exactly, the word being typed is
 * prefix-matched, and `operator=AND` requires every word (the default, `OR`,
 * ranks cards matching more of them higher). Until the index exists and covers
 * the corpus — or for an underlined-text search, which it cannot express —
 * the route falls back to the `LIKE` search.
 *
 * Each card carries its stored `sourceUrl` and, once the admin URL recheck
 * has covered it, a `urlCheck` (`@/lib/search/card-url-checks`) the result
 * list and reader turn into a status icon on the source link.
 *
 * When D1 answers "overloaded", the route stops sending it work for a few
 * seconds and answers `503 { busy: true }` with `Retry-After`, rather than
 * trying fallback queries that would each fail the same way and keep the
 * database overloaded. An index check that fails no longer drops the search
 * to the `LIKE` scan either — that scan is the heaviest query here.
 *
 * Metered by plan tier (`@debate-ai/webview/src/lib/stripe/limits.ts`): each search counts toward
 * the caller's `cardSearchesPerDay` (per IP when signed out) and returns at
 * most the tier's `cardSearchResults` cards.
 */
import { type NextRequest, NextResponse } from "next/server";
import { hydrateCardText, hydrateCaselistDocHtml } from "@/lib/search/card-text-store";
import { attachCardUrlChecks } from "@/lib/search/card-url-checks";
import { getDBFromContext } from "@/lib/database/context";
import {
  caselistDocuments,
  debateCards,
  youtubeRoundVideos,
  type CaselistDocumentRow,
  type DebateCardRow,
} from "@/lib/database/schema";
import { desc, or } from "drizzle-orm";
import { getUserId } from "@/lib/auth/session";
import { limitsFor } from "@debate-ai/webview/lib/stripe/limits";
import { consumeDailyUsage, getUserTier, limitMessage, planLimitHeaders, usageSubject } from "@/lib/stripe/usage";
import {
  buildCardSearchOrderBy,
  buildCardSearchWhere,
  buildRecentCardOrderBy,
  contains,
  mapCaselistDocumentToSearchResult,
  mapDebateCardToSearchResult,
  mapRoundVideoToSearchResult,
  readSearchKind,
  readSearchScope,
  sortSearchResults,
} from "@/lib/search/debate-card-search";
import {
  buildFtsMatch,
  cardFtsState,
  ftsColumnsForScope,
  readFtsOperator,
  searchCardsRanked,
} from "@/lib/search/card-fts";
import { TIMED_OUT, withinDeadline } from "@debate-ai/webview/lib/search/deadline";
import { describeError, isD1Overloaded } from "@/lib/database/errors";
import { BUSY_RETRY_AFTER_SECONDS } from "@/lib/api/route-errors";

/**
 * The search `/research/cards` opens with (no term, no filter) is the same
 * list for everyone on a plan, and it orders the whole `debate_cards` table
 * by import time, which has no index to read it from. Each Worker isolate
 * keeps that list for a few minutes instead of re-sorting the corpus on every
 * page open. Usage is still counted per request, before the cache is read.
 */
const BROWSE_CACHE_TTL_MS = 5 * 60 * 1000;
const browseCache = new Map<string, { at: number; results: unknown[] }>();

/**
 * How long each query may run before the route stops waiting for it. Ranked
 * FTS gets the first slot; past it, the unranked FTS query (the first matches
 * the inverted index yields, no BM25 sort) gets the second. The `LIKE` scan,
 * used only when the index can't serve the search, gets the third. A query
 * that runs out answers with `timedOut: true` and whatever it could return, so
 * the whole request stays well inside the client's own timeout.
 */
const RANKED_TIMEOUT_MS = 2_500;
const UNRANKED_TIMEOUT_MS = 2_000;
const LIKE_TIMEOUT_MS = 4_000;

/**
 * Searches whose ranked query ran out of time recently. A query that times out
 * is not cancelled — D1 finishes the BM25 sort anyway — so asking for the same
 * ranking again (the same term re-run, paged, or re-sorted in the browser)
 * spends that work a second time only to time out again. For a while after,
 * such a search goes straight to the unranked query.
 */
const SLOW_RANKED_TTL_MS = 10 * 60 * 1000;
const SLOW_RANKED_MAX = 500;
const slowRanked = new Map<string, number>();

/**
 * Until when this isolate stops sending searches to D1 after D1 answered
 * "overloaded". Every statement in D1's 10-second window fails the same way,
 * so more queries only add load.
 */
let busyUntil = 0;

/** The answer while D1 is overloaded: no results, and when to try again. */
function busyResponse() {
  return NextResponse.json(
    { results: [], total: 0, busy: true, error: "Card search is busy right now. Try again in a few seconds." },
    { status: 503, headers: { "Retry-After": String(BUSY_RETRY_AFTER_SECONDS) } },
  );
}

/** Notes that D1 is overloaded, so this isolate holds off for {@link BUSY_RETRY_AFTER_SECONDS}. */
function markBusy(now = Date.now()) {
  busyUntil = now + BUSY_RETRY_AFTER_SECONDS * 1000;
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const sortBy = searchParams.get("sort") || "_text_match:desc";
  const kind = readSearchKind(searchParams);
  const term = (searchParams.get("q") || "").trim();

  const scope = readSearchScope(searchParams);
  const filterInput = {
    year: searchParams.get("year") || "",
    school: searchParams.get("school") || "",
    team: searchParams.get("team") || "",
    tournament: searchParams.get("tournament") || "",
    event: searchParams.get("event") || "",
    ...scope,
  };
  const where = buildCardSearchWhere({ query: searchParams.get("q") || "", ...filterInput });

  if (Date.now() < busyUntil) return busyResponse();

  try {
    const db = await getDBFromContext();
    const userId = await getUserId();
    const tier = await getUserTier(db, userId);
    const limits = limitsFor(tier);
    const usage = await consumeDailyUsage(db, usageSubject(userId, request), "cardSearches", limits);
    if (!usage.allowed) {
      return NextResponse.json(
        { results: [], total: 0, error: limitMessage("cardSearches", usage, tier), limit: usage.limit, tier },
        { status: 429, headers: planLimitHeaders("cardSearches") },
      );
    }

    // The Outlines and Debates toggles list the most recently uploaded
    // documents and round videos, narrowed by the search term when there is one.
    if (kind === "outlines") {
      const rows = await db
        .select()
        .from(caselistDocuments)
        .where(
          term
            ? or(
                contains(caselistDocuments.fileName, term),
                contains(caselistDocuments.school, term),
                contains(caselistDocuments.team, term),
              )
            : undefined,
        )
        .orderBy(desc(caselistDocuments.ingestedAt), desc(caselistDocuments.id))
        .limit(limits.cardSearchResults);
      const docs = await hydrateCaselistDocHtml(rows as CaselistDocumentRow[]);
      return NextResponse.json({ results: docs.map(mapCaselistDocumentToSearchResult), total: docs.length });
    }
    if (kind === "debates") {
      const rows = await db
        .select()
        .from(youtubeRoundVideos)
        .where(
          term
            ? or(
                contains(youtubeRoundVideos.title, term),
                contains(youtubeRoundVideos.channel, term),
                contains(youtubeRoundVideos.tournament, term),
                contains(youtubeRoundVideos.aff, term),
                contains(youtubeRoundVideos.neg, term),
              )
            : undefined,
        )
        .orderBy(desc(youtubeRoundVideos.publishedAt), desc(youtubeRoundVideos.createdAt))
        .limit(limits.cardSearchResults);
      return NextResponse.json({ results: rows.map(mapRoundVideoToSearchResult), total: rows.length });
    }

    const explicitOrder = buildCardSearchOrderBy(sortBy);

    // A term goes through the full-text index when it can: BM25 relevance
    // unless an explicit sort (most read) was chosen.
    const columns = term ? ftsColumnsForScope(scope) : null;
    const match =
      columns === null ? "" : buildFtsMatch(term, { operator: readFtsOperator(searchParams), prefixLastWord: true, columns });
    // An index that could not be checked is still tried: it almost always
    // exists, and the `LIKE` fallback would scan the whole table.
    const ftsState = match ? await cardFtsState(db) : "incomplete";
    if (match && ftsState !== "incomplete") {
      try {
        const filters = buildCardSearchWhere(filterInput);
        const slowKey = `${match}|${sortBy}|${JSON.stringify(filterInput)}|${limits.cardSearchResults}`;
        const slowAt = slowRanked.get(slowKey);
        const skipRanked = slowAt !== undefined && Date.now() - slowAt < SLOW_RANKED_TTL_MS;
        const ranked = skipRanked
          ? TIMED_OUT
          : await withinDeadline(
              searchCardsRanked(db, match, filters, limits.cardSearchResults, explicitOrder),
              RANKED_TIMEOUT_MS,
            );
        if (ranked === TIMED_OUT && !skipRanked) {
          if (slowRanked.size >= SLOW_RANKED_MAX) slowRanked.clear();
          slowRanked.set(slowKey, Date.now());
        }
        if (ranked !== TIMED_OUT) {
          const results = sortSearchResults((await attachCardUrlChecks(db, await hydrateCardText(ranked))).map(mapDebateCardToSearchResult), sortBy);
          return NextResponse.json({ results, total: results.length });
        }
        // BM25 sorts every match, and a common word matches most of the corpus.
        // The unranked query stops at the limit, so it answers in time.
        const quick = await withinDeadline(
          searchCardsRanked(db, match, filters, limits.cardSearchResults, explicitOrder, false),
          UNRANKED_TIMEOUT_MS,
        );
        const results =
          quick === TIMED_OUT ? [] : sortSearchResults((await attachCardUrlChecks(db, await hydrateCardText(quick))).map(mapDebateCardToSearchResult), sortBy);
        return NextResponse.json({ results, total: results.length, timedOut: true });
      } catch (error) {
        if (isD1Overloaded(error)) throw error;
        console.error("Ranked card search failed; falling back to LIKE:", error);
      }
    }

    // Quotes: an explicit sort (most read, season…) wins; otherwise newest first.
    const browseKey = where === undefined ? `${kind ?? ""}|${sortBy}|${limits.cardSearchResults}` : null;
    const cached = browseKey ? browseCache.get(browseKey) : undefined;
    if (cached && Date.now() - cached.at < BROWSE_CACHE_TTL_MS) {
      return NextResponse.json({ results: cached.results, total: cached.results.length });
    }

    const orderBy = explicitOrder.length > 0 || kind !== "quotes" ? explicitOrder : buildRecentCardOrderBy();
    const cards = await withinDeadline(
      db.select().from(debateCards).where(where).orderBy(...orderBy).limit(limits.cardSearchResults) as Promise<DebateCardRow[]>,
      LIKE_TIMEOUT_MS,
    );
    if (cards === TIMED_OUT) return NextResponse.json({ results: [], total: 0, timedOut: true });
    const results = sortSearchResults((await attachCardUrlChecks(db, await hydrateCardText(cards))).map(mapDebateCardToSearchResult), sortBy);
    if (browseKey) browseCache.set(browseKey, { at: Date.now(), results });

    return NextResponse.json({ results, total: results.length });
  } catch (error) {
    if (isD1Overloaded(error)) {
      markBusy();
      console.warn("Card search busy: D1 is overloaded");
      return busyResponse();
    }
    console.error("Search error:", describeError(error));
    return NextResponse.json({ results: [], total: 0 });
  }
}
