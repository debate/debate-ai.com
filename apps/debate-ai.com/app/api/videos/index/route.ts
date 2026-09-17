import { NextResponse, type NextRequest } from "next/server";
import { getVideoIndex } from "@/lib/videos/video-repository";

/**
 * The whole video library, or what has changed in it since a given moment.
 *
 * `/api/videos` pages the library for a first paint; this ships it once so the
 * client can keep it in `localStorage` and answer its own filter, search and
 * sort locally. After the first visit a page load sends its cursor and
 * normally gets an empty `rows` back — a few hundred bytes instead of a
 * megabyte, and no request at all for every subsequent interaction.
 *
 * Responses are per-library, not per-user: no session is read here and none of
 * the per-user stores (favourites, hidden videos, watch history) appear in it,
 * so it is safe for the shared HTTP cache.
 *
 * Query parameters:
 * - `since` — epoch milliseconds from the client's last sync; omit for the
 *   whole library. A response with `partial: false` is a full library
 *   whatever was asked for, and replaces the client's cache.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const sinceParam = Number.parseInt(searchParams.get("since") ?? "", 10);
  const since = Number.isFinite(sinceParam) && sinceParam > 0 ? sinceParam : null;

  try {
    const index = await getVideoIndex(since);
    return NextResponse.json(index, {
      headers: {
        // Short, because the point of the cursor is that the next request is
        // cheap anyway; long enough that a burst of tabs opening shares one.
        "Cache-Control": "public, max-age=60, stale-while-revalidate=300",
      },
    });
  } catch (error) {
    console.error("Failed to build video index", error);
    return NextResponse.json({ error: "Failed to build video index" }, { status: 500 });
  }
}
