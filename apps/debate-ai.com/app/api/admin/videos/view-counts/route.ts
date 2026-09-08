import { NextResponse } from "next/server";
import { count } from "drizzle-orm";
import { getAdminAccess } from "@/lib/auth/admin";
import { getDBFromContext } from "@/lib/database/context";
import { videos, youtubeRoundVideos } from "@/lib/database/schema";
import { resyncVideoViewCounts } from "@/lib/videos/resync-view-counts";

/**
 * Refetches every stored video's YouTube view count and writes back the ones
 * that changed, across both the published `videos` table and the admin resync
 * queue.
 *
 * Stored counts are whatever YouTube reported when the video was ingested, so
 * they only ever fall behind — and the library's "most viewed" sort is built
 * on them. Re-running is safe: rows are matched by video id, only changed
 * counts are written, and nothing else on the row is touched.
 */
export async function POST() {
  const { isAdmin } = await getAdminAccess();
  if (!isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const db = await getDBFromContext();
    const result = await resyncVideoViewCounts(db);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error("Error resyncing video view counts:", error);
    return NextResponse.json(
      { error: "Failed to resync view counts", details: (error as Error).message },
      { status: 500 },
    );
  }
}

/** How many videos a resync would cover, so the button can size the run. */
export async function GET() {
  const { isAdmin } = await getAdminAccess();
  if (!isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const db = await getDBFromContext();
    const [published] = await db.select({ rows: count() }).from(videos);
    const [queued] = await db.select({ rows: count() }).from(youtubeRoundVideos);

    // The two tables overlap on rounds that are queued and published alike,
    // so this is an upper bound on the ids a run actually asks YouTube for.
    return NextResponse.json({
      publishedVideos: published?.rows ?? 0,
      queuedVideos: queued?.rows ?? 0,
    });
  } catch (error) {
    console.error("Error reading view count status:", error);
    return NextResponse.json({ publishedVideos: 0, queuedVideos: 0 });
  }
}
