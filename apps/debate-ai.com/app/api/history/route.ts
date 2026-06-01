import { NextResponse } from "next/server"
import debateTopics from "@/packages/debate-data-sync/data/metadata/debate-topics.json"
import debateChampions from "@/packages/debate-data-sync/data/metadata/debate-champions.json"

function getDebateHistory() {
  const history: Record<string, Record<string, string | undefined>> = {}
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
