/**
 * Last-name completion for the card search's author filter.
 *
 * `GET /api/search/authors?q=chi` lists the author last names in the card
 * corpus that start with the prefix, most-carded first. Not metered — it reads
 * the short cites, not cards — and it answers an empty list rather than an
 * error when the database fails, so the filter degrades to a plain input.
 * When the lookup runs out of time (the cite index is built by the weekly
 * cron) it falls back to the common surnames list.
 */
import { type NextRequest, NextResponse } from "next/server";
import { getDBFromContext } from "@/lib/database/context";
import { TIMED_OUT, withinDeadline } from "@debate-ai/webview/lib/search/deadline";
import {
  commonSurnamesStartingWith,
  MIN_AUTHOR_PREFIX,
  suggestAuthorLastNames,
} from "@/lib/search/card-authors";

const DEFAULT_LIMIT = 8;
const MAX_LIMIT = 20;
const LOOKUP_DEADLINE_MS = 2500;

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const query = (params.get("q") ?? "").trim().slice(0, 50);
  const requested = Number(params.get("limit"));
  const limit = Number.isInteger(requested) && requested > 0 ? Math.min(requested, MAX_LIMIT) : DEFAULT_LIMIT;
  if (query.length < MIN_AUTHOR_PREFIX) return NextResponse.json({ query, authors: [] });

  try {
    const db = await getDBFromContext();
    const found = await withinDeadline(suggestAuthorLastNames(db, query, limit), LOOKUP_DEADLINE_MS);
    if (found === TIMED_OUT) return NextResponse.json({ query, authors: commonSurnamesStartingWith(query, limit) });
    return NextResponse.json(
      { query, authors: found },
      { headers: { "Cache-Control": "public, max-age=300, stale-while-revalidate=3600" } },
    );
  } catch (error) {
    console.error("Author suggestions error:", error);
    return NextResponse.json({ query, authors: [] });
  }
}
