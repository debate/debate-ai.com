import { NextResponse, type NextRequest } from "next/server";
import { getVideoPage } from "@/lib/videos/video-repository";
import type { VideoQueryParams } from "debate-data-sync/src/videos/video-query";

/**
 * Paginated video feed.
 *
 * Replaces the previous endpoint, which shipped every round and lecture as one
 * ~1.1 MB JSON blob on first paint. Videos now live in the `videos` SQL table
 * (Cloudflare D1 in production, local SQLite in development) and are served a
 * page at a time as the grid is scrolled, with filtering, search and sorting
 * pushed down into SQL. `/api/videos/meta` carries the small, page-level
 * metadata that used to ride along in the same response.
 *
 * Query parameters:
 * - `source` — `round`, `lecture` or `all` (default)
 * - `lecturesOnly` — `1` keeps only videos without a numeric debate style
 * - `topPicks` — `1` keeps only top picks
 * - `category` — lecture category slug (e.g. `demo_debates`)
 * - `style` — numeric debate style, 1–4
 * - `year` — season year (`2026`) or `legacy`
 * - `q` — free-text search over title, channel and description
 * - `ids` — comma-separated id allow-list (used by the favourites filter)
 * - `sort` — `Views` or `Recency` (default)
 * - `limit` / `offset` — page size (max 200) and page start
 * - `facets` — `1` to include the season/style dropdown counts
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  const sourceParam = searchParams.get("source");
  const source: VideoQueryParams["source"] =
    sourceParam === "round" || sourceParam === "lecture" ? sourceParam : "all";

  const styleParam = Number.parseInt(searchParams.get("style") ?? "", 10);
  const limitParam = Number.parseInt(searchParams.get("limit") ?? "", 10);
  const offsetParam = Number.parseInt(searchParams.get("offset") ?? "", 10);
  const idsParam = searchParams.get("ids");

  const params: VideoQueryParams = {
    source,
    lecturesOnly: searchParams.get("lecturesOnly") === "1",
    topPicksOnly: searchParams.get("topPicks") === "1",
    categoryKey: searchParams.get("category") || null,
    style: Number.isFinite(styleParam) ? styleParam : null,
    year: searchParams.get("year"),
    q: searchParams.get("q"),
    ids: idsParam ? idsParam.split(",").map((id) => id.trim()).filter(Boolean).slice(0, 500) : null,
    sort: searchParams.get("sort"),
    limit: Number.isFinite(limitParam) ? limitParam : undefined,
    offset: Number.isFinite(offsetParam) ? offsetParam : 0,
  };

  // The favourites filter sends an explicit id list; an empty list means the
  // user has no favourites yet, which must return nothing rather than
  // everything.
  if (idsParam !== null && (params.ids?.length ?? 0) === 0) {
    return NextResponse.json({
      videos: [],
      total: 0,
      offset: params.offset ?? 0,
      limit: params.limit ?? 0,
      hasMore: false,
      facets: searchParams.get("facets") === "1" ? { yearCounts: {}, styleCounts: {} } : undefined,
      backend: "sql",
    });
  }

  try {
    const page = await getVideoPage(params, searchParams.get("facets") === "1");
    return NextResponse.json(page);
  } catch (error) {
    console.error("Failed to load videos", error);
    return NextResponse.json({ error: "Failed to load videos" }, { status: 500 });
  }
}
