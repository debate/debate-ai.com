import { NextResponse } from "next/server";
import { getDBFromContext } from "@/lib/database/context";
import { getYouTubeStats } from "@/lib/videos/youtube-stats";

/**
 * YouTube view statistics for the video library — totals by channel, debate
 * style, year and elimination round — computed in SQL from the `videos` table
 * (see `lib/videos/youtube-stats.ts`). Read by the `/practice/statistics`
 * charts and the videos-page stats modal.
 */
export async function GET() {
  try {
    const db = await getDBFromContext();
    return NextResponse.json(await getYouTubeStats(db), {
      headers: { "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400" },
    });
  } catch (error) {
    console.error("Failed to compute YouTube stats", error);
    return NextResponse.json({ error: "Failed to compute YouTube stats" }, { status: 500 });
  }
}
