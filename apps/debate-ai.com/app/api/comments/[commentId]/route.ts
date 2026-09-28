import { NextRequest, NextResponse } from "next/server"
import { getDBFromContext } from "@/lib/database/context"
import { getUserId } from "@/lib/auth/session"
import { withRouteErrors } from "@/lib/api/route-errors"
import { deleteOwnComment } from "@/lib/comments/queries"

/**
 * Removes one comment.
 *
 * DELETE — soft-deletes the current user's own comment: the body is blanked and
 * the row is stamped, and its replies stay. Deleting a post should not take a
 * sub-conversation down with it, and hard-deleting the row would cascade
 * through `comments.parent_id` and do exactly that.
 *
 * Author-only, checked against the row's `authorId` rather than trusted from
 * the request — a 403 here is the whole reason the check is in the query
 * (`lib/comments/queries.ts#deleteOwnComment`) rather than in the UI, which
 * only hides the button.
 */

export const DELETE = withRouteErrors(
  "DELETE /api/comments/[commentId]",
  async (_req: NextRequest, { params }: { params: Promise<{ commentId: string }> }) => {
    const userId = await getUserId()
    if (!userId) {
      return NextResponse.json({ error: "Sign in to delete your comments." }, { status: 401 })
    }

    const { commentId } = await params
    const db = await getDBFromContext()
    const result = await deleteOwnComment(db, { commentId, userId })

    if (!result.ok) {
      // 404 for a comment that is not there, 403 for one that is not yours —
      // except that "someone else's comment" and "no comment" answer the same
      // way, so a caller cannot use this endpoint to discover which comment ids
      // exist on a resource it is not signed in as.
      const status = result.error.includes("your own") ? 403 : 404
      return NextResponse.json({ error: result.error }, { status })
    }

    return NextResponse.json({ deleted: true })
  },
)
