import { NextResponse } from "next/server"
import { syncYouTubeVideos } from "@/lib/sync-debate-sites/sync-youtube-rounds"

export async function GET() {
  try {
    const result = await syncYouTubeVideos()
    return NextResponse.json(result)
  } catch (error) {
    console.error("Error syncing videos:", error)
    return NextResponse.json({ error: "Failed to sync videos", details: (error as Error).message }, { status: 500 })
  }
}
