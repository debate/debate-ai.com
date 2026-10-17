import { NextRequest, NextResponse } from "next/server"
import { getDBFromContext } from "@/lib/database/context"
import { getUserId } from "@/lib/auth/session"
import { withRouteErrors } from "@/lib/api/route-errors"
import { toggleCommentLike } from "@/lib/comments/queries"

/**
 * Flips the current user's like on one comment.
 *
 * POST — likes it if it is not liked, unlikes it if it is, and answers with
 * the state the table actually holds afterwards. There is no "set to liked"
 * and no separate un-like route: one button wants one handler, and a toggle
 * cannot be expressed as a set without the client telling the server which way
 * it was pointing, which is exactly the state the button is already keeping.
 *
 * The count comes back from a `COUNT` rather than from "previous plus one", so
 * two tabs, a double-click, and two people liking the same comment at the same
 * moment all settle on a number the rows support.
 */

export const POST = withRouteErrors(
  "POST /api/comments/[commentId]/like",
  async (_req: NextRequest, { params }: { params: Promise<{ commentId: string }> }) => {
    const userId = await getUserId()
    if (!userId) {
      return NextResponse.json({ error: "Sign in to like comments." }, { status: 401 })
    }

    const { commentId } = await params
    const db = await getDBFromContext()
    const result = await toggleCommentLike(db, { commentId, userId })

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 404 })
    }

    return NextResponse.json(result.value)
  },
)
