import { NextRequest, NextResponse } from "next/server"
import { getDBFromContext } from "@/lib/database/context"
import { getUserId } from "@/lib/auth/session"
import { withRouteErrors } from "@/lib/api/route-errors"
import { castTopicAreaVote, getTopicAreaPoll } from "@/lib/topic-area-poll/queries"
import { nextPollSeason, parseVoteBody } from "@debate/videos/src/lib/topic-areas/topic-area-poll"

/**
 * The next-season topic-area poll on /practice/statistics.
 *
 * GET — the ranked-choice tally for `?season=` (defaults to next season),
 * readable signed out; a signed-in reader also gets their own ballot back as
 * `myRanking`.
 *
 * PUT `{ season, ranking }` — casts or replaces the signed-in user's ballot:
 * one to five distinct topic areas, best first. Only next season is open.
 */

export const GET = withRouteErrors("GET /api/topic-area-poll", async (req: NextRequest) => {
  const raw = req.nextUrl.searchParams.get("season")
  const season = raw === null ? nextPollSeason() : Number(raw)
  if (!Number.isInteger(season)) {
    return NextResponse.json({ error: "season must be a year." }, { status: 400 })
  }
  const userId = await getUserId()
  const db = await getDBFromContext()
  return NextResponse.json(await getTopicAreaPoll(db, season, userId))
})

export const PUT = withRouteErrors("PUT /api/topic-area-poll", async (req: NextRequest) => {
  const userId = await getUserId()
  if (!userId) {
    return NextResponse.json({ error: "Sign in to vote." }, { status: 401 })
  }
  const parsed = parseVoteBody(await req.json().catch(() => null))
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 })
  }
  const db = await getDBFromContext()
  return NextResponse.json(await castTopicAreaVote(db, { season: parsed.season, userId, ranking: parsed.ranking }))
})
