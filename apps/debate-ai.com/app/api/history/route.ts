import { NextResponse } from "next/server"
import debateTopics from "debate-data-sync/data/metadata/debate-topics.json"
import debateChampions from "debate-data-sync/data/metadata/debate-champions.json"
import type { DebateHistory } from "debate-videos"

function getDebateHistory(): DebateHistory {
  const history: DebateHistory = {}
  for (const entry of debateTopics.data) {
    const { year, ...rest } = entry
    history[String(year)] = { ...history[String(year)], ...rest }
  }
  for (const entry of debateChampions.data) {
    const { year, ...rest } = entry
    history[String(year)] = { ...history[String(year)], ...rest }
  }
  return history
}

export async function GET() {
  return NextResponse.json(getDebateHistory())
}
