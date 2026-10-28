import { NextResponse } from "next/server"
import debateTopics from "@debate-ai/rankings-adapter/data/debate-topics.json"
import debateChampions from "@debate-ai/rankings-adapter/data/debate-champions.json"
import type { DebateHistory } from "@debate-ai/rankings-adapter/leaderboard"

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
