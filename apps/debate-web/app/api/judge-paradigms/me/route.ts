import { NextRequest, NextResponse } from "next/server"
import { getUserId } from "@/lib/auth/session"
import { withRouteErrors } from "@/lib/api/route-errors"
import { getDBFromContext } from "@/lib/database/context"
import { getOwnParadigm, saveOwnParadigm } from "@/lib/judge-paradigms/queries"
import { parseOwnParadigmInput } from "@debate-ai/tournaments/judge-paradigms/types"

/**
 * The viewer's own judge paradigm, edited at `/practice/paradigm`.
 *
 * GET — the paradigm, the Tabroom judge it is linked to, whether that link is
 *   verified, and the code to verify it with.
 * PUT { tabroomPersonId, markdown } — saves it and returns it as stored.
 *   Linking a different Tabroom judge clears the verification.
 */

export const GET = withRouteErrors("GET /api/judge-paradigms/me", async () => {
  const userId = await getUserId()
  if (!userId) return NextResponse.json({ error: "Sign in to edit your paradigm." }, { status: 401 })
  return NextResponse.json(await getOwnParadigm(await getDBFromContext(), userId))
})

export const PUT = withRouteErrors("PUT /api/judge-paradigms/me", async (req: NextRequest) => {
  const userId = await getUserId()
  if (!userId) return NextResponse.json({ error: "Sign in to edit your paradigm." }, { status: 401 })
  let payload: unknown
  try {
    payload = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 })
  }
  const input = parseOwnParadigmInput(payload)
  if (!input.ok) return NextResponse.json({ error: input.error }, { status: 400 })
  return NextResponse.json(await saveOwnParadigm(await getDBFromContext(), userId, input.value))
})
