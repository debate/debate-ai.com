import { NextResponse } from "next/server"
import { getAdminAccess } from "@/lib/auth/admin"
import { getDBFromContext } from "@/lib/database/context"
import { resyncYouTubeRounds } from "@/lib/youtube/resync-rounds"
import { resyncVideoViewCounts } from "@/lib/videos/resync-view-counts"

/**
 * Refreshes the library from YouTube: new rounds into the admin queue, then
 * view counts and availability across everything already stored.
 *
 * This used to call `syncYouTubeVideos` from `debate-data-sync`, which is a
 * *CLI* routine — it rewrites the committed `data/videos/*.json` assets with
 * `fs.writeFile`. On Cloudflare there is no writable filesystem, so the
 * endpoint could only ever fail: it spent a minute calling the YouTube API
 * and then died on the first write, which is the "sync errors" this page
 * reported. That routine still exists for a checkout, run from the CLI;
 * what the deployment runs is the D1-backed path the admin buttons use.
 *
 * Admin-only, because it costs real YouTube API quota.
 */
export async function POST() {
  const { isAdmin, email } = await getAdminAccess()
  if (!isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  try {
    const rounds = await resyncYouTubeRounds(email)
    // Only after the queue is refreshed: the view-count pass reads both
    // tables, so running it second lets it cover anything just ingested.
    const db = await getDBFromContext()
    const viewCounts = await resyncVideoViewCounts(db)

    return NextResponse.json({ ok: true, rounds, viewCounts })
  } catch (error) {
    console.error("Error syncing videos:", error)
    return NextResponse.json(
      { error: "Failed to sync videos", details: (error as Error).message },
      { status: 500 },
    )
  }
}

/** Kept so existing links still work; the sync itself is a POST. */
export async function GET() {
  return NextResponse.json(
    { error: "Use POST to run a sync" },
    { status: 405, headers: { Allow: "POST" } },
  )
}
