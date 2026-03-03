import { NextResponse } from "next/server"
import debateTopics from "@/lib/debate-data/debate-topics.json"
import debateChampions from "@/lib/debate-data/debate-champions.json"

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

export async function GET() {
  return NextResponse.json(getDebateHistory())
}
