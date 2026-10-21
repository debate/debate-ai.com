import { NextResponse } from "next/server"
import { getUserId } from "@/lib/auth/session"
import { withRouteErrors } from "@/lib/api/route-errors"
import { getDBFromContext } from "@/lib/database/context"
import { verifyOwnParadigm } from "@/lib/judge-paradigms/queries"

/**
 * POST — verifies the viewer as their linked Tabroom judge: their Tabroom
 * paradigm, read fresh, must contain their verification code. Answers the
 * paradigm as stored, now verified, or `{ error }` saying what's missing.
 */
export const POST = withRouteErrors("POST /api/judge-paradigms/me/verify", async () => {
  const userId = await getUserId()
  if (!userId) return NextResponse.json({ error: "Sign in to verify your paradigm." }, { status: 401 })
  const result = await verifyOwnParadigm(await getDBFromContext(), userId)
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status })
  return NextResponse.json(result.paradigm)
})
