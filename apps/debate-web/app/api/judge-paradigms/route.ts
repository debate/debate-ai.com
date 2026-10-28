import { NextRequest, NextResponse } from "next/server"
import { withRouteErrors } from "@/lib/api/route-errors"
import { getDBFromContext } from "@/lib/database/context"
import { loadJudgeProfile } from "@/lib/judge-paradigms/queries"
import { parseTabroomPersonId } from "@debate-ai/tournaments/judge-paradigms/types"

/**
 * A judge's paradigm and voting record, for the judge dialog in `/tournaments`
 * pairings.
 *
 * GET ?personId=N — by Tabroom person id.
 * GET ?first=&last= — by name, for a judge whose pairing carries no id.
 *
 * Answers `{ profile }`, `null` when no judge is found. Served from the
 * paradigm cache, fetched from Tabroom when the cached copy is missing or old
 * (see lib/judge-paradigms/queries.ts). Public, like the pairings themselves.
 */
export const GET = withRouteErrors("GET /api/judge-paradigms", async (req: NextRequest) => {
  const params = new URL(req.url).searchParams
  const personId = parseTabroomPersonId(params.get("personId") ?? "")
  const first = (params.get("first") ?? "").trim().slice(0, 60)
  const last = (params.get("last") ?? "").trim().slice(0, 60)
  if (!personId && !(first && last)) {
    return NextResponse.json({ error: "Give ?personId= or ?first=&last=." }, { status: 400 })
  }
  const profile = await loadJudgeProfile(await getDBFromContext(), { personId, first, last })
  return NextResponse.json(
    { profile },
    // Short, so a judge who just verified or edited sees it soon.
    { headers: { "cache-control": "public, max-age=300" } },
  )
})
