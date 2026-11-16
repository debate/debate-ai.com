import { NextResponse } from "next/server"
import { getDBFromContext } from "@/lib/database/context"
import { getSession } from "@/lib/auth/session"
import { withRouteErrors } from "@/lib/api/route-errors"
import { getOrCreateUserHandle } from "@/lib/users/user-handles"

/**
 * The signed-in user's username — the first segment of their personal files'
 * `/<username>/<folder path>/<doc slug>` addresses.
 *
 * GET — `{ handle }`, assigned from the user's name on first ask and numbered
 * when taken (`alexgul`, `alexgul2`, …; see `lib/users/user-handles.ts`).
 * `{ handle: null }` when signed out.
 */
export const GET = withRouteErrors("GET /api/users/handle", async () => {
  const session = await getSession()
  if (!session) return NextResponse.json({ handle: null })
  const db = await getDBFromContext()
  const handle = await getOrCreateUserHandle(db, session.user)
  return NextResponse.json({ handle })
})
