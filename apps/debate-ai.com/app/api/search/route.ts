/**
 * Public search endpoint for the imported debate-card corpus.
 *
 * The admin Parquet importer writes normalized rows to `debate_cards`.  This
 * route is deliberately the other half of that feature: `/cards` reads those
 * rows directly instead of falling back to a separate in-memory demo corpus.
 *
 * The query building and row mapping live in `@/lib/search/debate-card-search`
 * so the SQL this issues is unit tested against a real SQLite database — the
 * route's catch-all turns a malformed query into an empty result list rather
 * than an error, which is exactly how a broken `where` clause hid here before.
 */
import { type NextRequest, NextResponse } from "next/server";
import { getDBFromContext } from "@/lib/database/context";
import { debateCards } from "@/lib/database/schema";
import {
  buildCardSearchWhere,
  mapDebateCardToSearchResult,
  readSearchScope,
  sortSearchResults,
} from "@/lib/search/debate-card-search";

/** Most cards one search returns; the UI pages through what it is given. */
const SEARCH_LIMIT = 200;

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
    const cards = await db.select().from(debateCards).where(where).limit(SEARCH_LIMIT);
    const results = sortSearchResults(cards.map(mapDebateCardToSearchResult), sortBy);

    return NextResponse.json({ results, total: results.length });
  } catch (error) {
    console.error("Search error:", error);
    return NextResponse.json({ results: [], total: 0 });
  }
}
