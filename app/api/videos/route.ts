import { type NextRequest, NextResponse } from "next/server"
import debateVideos from "@/lib/debate-data/debate-videos.json"
import debateHistory from "@/lib/debate-data/debate-history.json"

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const type = searchParams.get("type")

  if (type === "videos") {
    return NextResponse.json(debateVideos)
  } else if (type === "history") {
    return NextResponse.json(debateHistory)
  }

  return NextResponse.json({ error: "Invalid type parameter" }, { status: 400 })
}
