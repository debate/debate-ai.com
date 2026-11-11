import { NextRequest, NextResponse } from "next/server"
import { getDBFromContext } from "@/lib/database/context"
import { getUserId } from "@/lib/auth/session"
import { withRouteErrors } from "@/lib/api/route-errors"
import { ensureForumTables } from "@/lib/forums/ensure-tables"
import { toggleForumThreadLike } from "@/lib/forums/queries"

/**
 * Flips the current user's like on a forum thread's opening post.
 *
 * POST — likes it if it is not liked, unlikes it if it is, and answers with
 * `{ liked, likeCount }` as the rows hold them afterwards: the same toggle as
 * `POST /api/comments/:id/like`, for the post the replies hang off. Replies
 * are comments and are liked through that route.
 */

export const POST = withRouteErrors(
  "POST /api/forums/[threadId]/like",
  async (_req: NextRequest, { params }: { params: Promise<{ threadId: string }> }) => {
    const userId = await getUserId()
    if (!userId) {
      return NextResponse.json({ error: "Sign in to like threads." }, { status: 401 })
    }

    const { threadId } = await params
    const db = await getDBFromContext()
    await ensureForumTables(db)
    const result = await toggleForumThreadLike(db, { threadId, userId })

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 404 })
    }

    return NextResponse.json(result.value)
  },
)
