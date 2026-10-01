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
 * Metered by plan tier (`debate-webview/src/lib/stripe/limits.ts`): each search counts toward
 * the caller's `cardSearchesPerDay` (per IP when signed out) and returns at
 * most the tier's `cardSearchResults` cards.
 */
import { type NextRequest, NextResponse } from "next/server";
import { getDBFromContext } from "@/lib/database/context";
import { debateCards } from "@/lib/database/schema";
import { getUserId } from "@/lib/auth/session";
import { limitsFor } from "debate-webview/lib/stripe/limits";
import { consumeDailyUsage, getUserTier, limitMessage, planLimitHeaders, usageSubject } from "@/lib/stripe/usage";
import {
  buildCardSearchOrderBy,
  buildCardSearchWhere,
  mapDebateCardToSearchResult,
  readSearchScope,
  sortSearchResults,
} from "@/lib/search/debate-card-search";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const sortBy = searchParams.get("sort") || "_text_match:desc";

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
    const cards = await db
      .select()
      .from(debateCards)
      .where(where)
      .orderBy(...buildCardSearchOrderBy(sortBy))
      .limit(limits.cardSearchResults);
    const results = sortSearchResults(cards.map(mapDebateCardToSearchResult), sortBy);

    return NextResponse.json({ results, total: results.length });
  } catch (error) {
    console.error("Search error:", error);
    return NextResponse.json({ results: [], total: 0 });
  }
}
