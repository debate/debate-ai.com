import { NextResponse, type NextRequest } from "next/server";
import topics from "debate-data-sync/data/metadata/debate-topics.json";
import champions from "debate-data-sync/data/metadata/debate-champions.json";
import { getVideoMeta, getVideoSuggestions } from "@/lib/videos/video-repository";
import type { VideoQueryParams } from "debate-data-sync/src/videos/video-query";
import type { DebateHistory } from "debate-videos";

/**
 * Page-level video metadata: library counts for the quick-link cards, the
 * lecture-category cards, and the season topic/champion tables the grid and
 * the rankings leaderboard render.
 *
 * This is the small, fetch-once companion to the paginated `/api/videos`
 * feed — everything here is bounded in size and does not grow with the number
 * of videos.
 */
function getDebateHistory(): DebateHistory {
  const history: DebateHistory = {};
  for (const entry of topics.data) {
    const { year, ...rest } = entry;
    history[String(year)] = { ...history[String(year)], ...rest };
  }
  for (const entry of champions.data) {
    const { year, ...rest } = entry;
    history[String(year)] = { ...history[String(year)], ...rest };
  }
  return history;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const style = Number.parseInt(searchParams.get("style") ?? "", 10);
    const source = searchParams.get("source");
    const suggestionScope: VideoQueryParams = {
      source: source === "round" || source === "lecture" ? source : "all",
      lecturesOnly: searchParams.get("lecturesOnly") === "1",
      topPicksOnly: searchParams.get("topPicks") === "1",
      categoryKey: searchParams.get("category") || null,
      style: Number.isFinite(style) ? style : null,
      year: searchParams.get("year"),
    };
    const [meta, suggestions] = await Promise.all([getVideoMeta(), getVideoSuggestions(suggestionScope)]);
    return NextResponse.json({
      ...meta,
      suggestions,
      topics: topics.data,
      champions: champions.data,
      history: getDebateHistory(),
    });
  } catch (error) {
    console.error("Failed to load video metadata", error);
    return NextResponse.json({ error: "Failed to load video metadata" }, { status: 500 });
  }
}
