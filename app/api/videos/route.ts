import { type NextRequest, NextResponse } from "next/server"
import debateVideos from "@/lib/debate-data/debate-videos.json"
import debateTopics from "@/lib/debate-data/debate-topics.json"
import debateChampions from "@/lib/debate-data/debate-champions.json"

/** Merge topics + champions arrays into a single Record<year, YearData> */
function getDebateHistory() {
  const history: Record<string, Record<string, string | undefined>> = {}
  for (const entry of debateTopics) {
    const { year, ...rest } = entry
    history[String(year)] = { ...history[String(year)], ...rest }
  }
  for (const entry of debateChampions) {
    const { year, ...rest } = entry
    history[String(year)] = { ...history[String(year)], ...rest }
  }
  return history
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const type = searchParams.get("type")

  if (type === "videos") {
    return NextResponse.json(debateVideos)
  } else if (type === "history") {
    return NextResponse.json(getDebateHistory())
  }

  return NextResponse.json({ error: "Invalid type parameter" }, { status: 400 })
}
