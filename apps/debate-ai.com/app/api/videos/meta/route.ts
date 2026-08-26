import { NextResponse } from "next/server";
import topics from "debate-data-sync/data/metadata/debate-topics.json";
import champions from "debate-data-sync/data/metadata/debate-champions.json";
import { getVideoMeta } from "@/lib/videos/video-repository";

/**
 * Page-level video metadata: library counts for the quick-link cards, the
 * lecture-category cards, and the season topic/champion tables the grid and
 * the rankings leaderboard render.
 *
 * This is the small, fetch-once companion to the paginated `/api/videos`
 * feed — everything here is bounded in size and does not grow with the number
 * of videos.
 */
function getDebateHistory() {
  const history: Record<string, Record<string, string | number | undefined>> = {};
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

export async function GET() {
  try {
    const meta = await getVideoMeta();
    return NextResponse.json({
      ...meta,
      topics: topics.data,
      champions: champions.data,
      history: getDebateHistory(),
    });
  } catch (error) {
    console.error("Failed to load video metadata", error);
    return NextResponse.json({ error: "Failed to load video metadata" }, { status: 500 });
  }
}
