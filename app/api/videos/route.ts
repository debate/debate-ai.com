import { NextResponse } from "next/server"
import rounds from "@/lib/debate-data/debate-rounds.json"
import topPicks from "@/lib/debate-data/debate-top-picks.json"
import lectures from "@/lib/debate-data/debate-lectures.json"

export async function GET() {
  return NextResponse.json({ rounds, topPicks, lectures })
}
