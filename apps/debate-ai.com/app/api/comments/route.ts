import { NextRequest, NextResponse } from "next/server"
import { getDBFromContext } from "@/lib/database/context"
import { getUserId } from "@/lib/auth/session"
import { withRouteErrors } from "@/lib/api/route-errors"
import { getCommentThread, insertComment, resolveReplyParent } from "@/lib/comments/queries"
import {
  parseCommentBody,
  parseParentId,
  parseResourceId,
  parseResourceType,
  type CommentResourceType,
  type Parsed,
} from "debate-webview/lib/comments/validation"

/**
 * The one comment surface, for every kind of thing that can be discussed.
 *
 * A thread is addressed by `resourceType` + `resourceId` rather than by a
 * dedicated route per kind, so `/videos/watch/x`, a lecture page and a card
 * contribution all read and write the same rows through the same three
 * handlers — see `lib/comments/queries.ts` and `packages/debate-comments`.
 *
 * GET  ?resourceType=&resourceId= — the whole thread, nested, plus the
 *   viewer. Public: a signed-out reader gets every comment and no composer,
 *   and `viewerId` only decides whose hearts arrive already filled in.
 * POST { resourceType, resourceId, parentId?, body } — a top-level comment or
 *   a reply. Account-only, 401 without a session, because a comment has to have
 *   an author whose name can be shown next to it.
 */

export const GET = withRouteErrors(
  "GET /api/comments",
  async (req: NextRequest) => {
    const resourceType = parseResourceType(req.nextUrl.searchParams.get("resourceType"))
    if (!resourceType.ok) {
      return NextResponse.json({ error: resourceType.error }, { status: 400 })
    }

    const resourceId = parseResourceId(req.nextUrl.searchParams.get("resourceId"))
    if (!resourceId.ok) {
      return NextResponse.json({ error: resourceId.error }, { status: 400 })
    }

    const db = await getDBFromContext()
    // A session lookup that throws must not take a public read down with it:
    // an anonymous reader is a normal reader, not a failed request.
    const viewerId = await getUserId().catch(() => null)

    const thread = await getCommentThread(db, {
      resourceType: resourceType.value,
      resourceId: resourceId.value,
      viewerId,
    })

    return NextResponse.json(thread)
  },
)

export const POST = withRouteErrors(
  "POST /api/comments",
  async (req: NextRequest) => {
    const userId = await getUserId()
    if (!userId) {
      return NextResponse.json({ error: "Sign in to comment." }, { status: 401 })
    }

    let payload: unknown
    try {
      payload = await req.json()
    } catch {
      return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 })
    }

    const { resourceType, resourceId, parentId, body } = readCreateBody(payload)

    // Checked one at a time, in a fixed order, so the first thing wrong with a
    // request is the first thing the caller is told about — a missing resource
    // type, rather than the empty body further down the same object. Each
    // check narrows its own value, which a loop over the results would not.
    if (!resourceType.ok) {
      return NextResponse.json({ error: resourceType.error }, { status: 400 })
    }
    if (!resourceId.ok) {
      return NextResponse.json({ error: resourceId.error }, { status: 400 })
    }
    if (!parentId.ok) {
      return NextResponse.json({ error: parentId.error }, { status: 400 })
    }
    if (!body.ok) {
      return NextResponse.json({ error: body.error }, { status: 400 })
    }

    const db = await getDBFromContext()
    const resource = { resourceType: resourceType.value, resourceId: resourceId.value }

    // The one check that needs a query: is the comment being answered a live
    // comment on *this* resource, and is there room under it? Also what stops
    // a caller from grafting a reply onto another page's thread.
    const parent = await resolveReplyParent(db, parentId, resource)
    if (!parent.ok) {
      return NextResponse.json({ error: parent.error }, { status: 400 })
    }

    const comment = await insertComment(db, {
      ...resource,
      parentId: parent.value.parentId,
      authorId: userId,
      body: body.value,
      id: crypto.randomUUID(),
    })

    return NextResponse.json(comment, { status: 201 })
  },
)

/**
 * Validates a create request in a fixed order, so the first error a caller is
 * told about is the first thing wrong with it — a missing resource type, say,
 * rather than the empty body further down the same object.
 */
function readCreateBody(payload: unknown): {
  resourceType: Parsed<CommentResourceType>;
  resourceId: Parsed<string>;
  parentId: Parsed<string | null>;
  body: Parsed<string>;
} {
  const raw = (payload ?? {}) as Record<string, unknown>
  return {
    resourceType: parseResourceType(raw.resourceType),
    resourceId: parseResourceId(raw.resourceId),
    parentId: parseParentId(raw.parentId),
    body: parseCommentBody(raw.body),
  }
}
