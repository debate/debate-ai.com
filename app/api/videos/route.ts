import { NextResponse } from "next/server"
import rounds from "@/lib/debate-data/debate-rounds-videos.json"
import topPicks from "@/lib/debate-data/debate-top-picks.json"
import lectures from "@/lib/debate-data/debate-lectures.json"
import topics from "@/lib/debate-data/debate-topics.json"
import champions from "@/lib/debate-data/debate-champions.json"

export async function GET() {
  return NextResponse.json({ rounds, topPicks, lectures, topics, champions })
}
