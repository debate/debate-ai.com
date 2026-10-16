/**
 * Word completion for the card search box.
 *
 * `GET /api/search/autocomplete?q=nuclear deter` completes the last word of
 * the query from the words indexed in the card corpus (FTS5's `fts5vocab`),
 * most frequent first, and returns each suggestion as the whole completed
 * query. Not metered — it reads the vocabulary, not cards — and answers an
 * empty list rather than an error whenever the index is unavailable, so the
 * search box degrades to a plain input.
 */
import { type NextRequest, NextResponse } from "next/server";
import { getDBFromContext } from "@/lib/database/context";
import { autocompleteCardTerms, ensureCardFts } from "@/lib/search/card-fts";

const DEFAULT_LIMIT = 8;
const MAX_LIMIT = 20;

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const query = (params.get("q") ?? "").slice(0, 200);
  const requested = Number(params.get("limit"));
  const limit = Number.isInteger(requested) && requested > 0 ? Math.min(requested, MAX_LIMIT) : DEFAULT_LIMIT;

  try {
    const db = await getDBFromContext();
    if (!(await ensureCardFts(db))) return NextResponse.json({ query, suggestions: [] });
    const suggestions = await autocompleteCardTerms(db, query, limit);
    // The vocabulary only moves when cards are imported; a few minutes of
    // caching spares the frequency sort on repeated prefixes.
    return NextResponse.json(
      { query, suggestions },
      { headers: { "Cache-Control": "public, max-age=300, stale-while-revalidate=3600" } },
    );
  } catch (error) {
    console.error("Autocomplete error:", error);
    return NextResponse.json({ query, suggestions: [] });
  }
}
