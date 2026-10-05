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
 * Metered by plan tier (`@debate/webview/src/lib/stripe/limits.ts`): each search counts toward
 * the caller's `cardSearchesPerDay` (per IP when signed out) and returns at
 * most the tier's `cardSearchResults` cards.
 */
import { type NextRequest, NextResponse } from "next/server";
import { getDBFromContext } from "@/lib/database/context";
import { caselistDocuments, debateCards, youtubeRoundVideos } from "@/lib/database/schema";
import { desc, or } from "drizzle-orm";
import { getUserId } from "@/lib/auth/session";
import { limitsFor } from "@debate/webview/lib/stripe/limits";
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

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const sortBy = searchParams.get("sort") || "_text_match:desc";
  const kind = readSearchKind(searchParams);
  const term = (searchParams.get("q") || "").trim();

  const where = buildCardSearchWhere({
    query: searchParams.get("q") || "",
    year: searchParams.get("year") || "",
    school: searchParams.get("school") || "",
    team: searchParams.get("team") || "",
    tournament: searchParams.get("tournament") || "",
    event: searchParams.get("event") || "",
    ...readSearchScope(searchParams),
  });

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
      return NextResponse.json({ results: rows.map(mapCaselistDocumentToSearchResult), total: rows.length });
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

    // Quotes: an explicit sort (most read, season…) wins; otherwise newest first.
    const explicitOrder = buildCardSearchOrderBy(sortBy);
    const orderBy = explicitOrder.length > 0 || kind !== "quotes" ? explicitOrder : buildRecentCardOrderBy();
    const cards = await db
      .select()
      .from(debateCards)
      .where(where)
      .orderBy(...orderBy)
      .limit(limits.cardSearchResults);
    const results = sortSearchResults(cards.map(mapDebateCardToSearchResult), sortBy);

    return NextResponse.json({ results, total: results.length });
  } catch (error) {
    console.error("Search error:", error);
    return NextResponse.json({ results: [], total: 0 });
  }
}
