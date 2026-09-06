import { NextRequest, NextResponse } from "next/server"
import { and, desc, eq, isNull } from "drizzle-orm"
import { getDBFromContext } from "@/lib/database/context"
import { notifications } from "@/lib/database/schema"
import { getUserId } from "@/lib/auth/session"

/**
 * Account-linked notifications — currently populated only by
 * `/api/rounds/invite`'s "invite a registered user" path, but written as a
 * general-purpose feed (`type`/`title`/`body`/`link`) rather than a
 * round-invite-specific shape so a future notification source can reuse it.
 * Powers the dock Settings menu's "Notifications" entry/unread badge and
 * `AccountNotificationsPanel` at `/notifications`
 * (`packages/debate-round/src/state/useAccountNotifications.ts` polls this
 * route and the app layer toasts newly-arrived ones). Account data, so both
 * handlers require a session and return 401 without one — same shape as
 * `/api/settings`.
 *
 * GET   — the current user's most recent notifications (newest first) plus
 *   `unreadCount`.
 * PATCH { id } | { all: true } — marks one notification (by id, ownership
 *   checked) or every unread notification as read.
 */

const LIST_LIMIT = 50

// A missing `notifications` table means the D1 migration for it just hasn't
// run against this environment yet (see the deploy-ordering note in the
// route handlers below) — an expected, self-resolving condition, not a bug,
// so it's worth keeping out of error-level alerting.
function logNotificationsDBError(message: string, error: unknown) {
  const text = error instanceof Error ? error.message : String(error)
  if (/no such table/i.test(text)) {
    console.warn(message, error)
  } else {
    console.error(message, error)
  }
}

export async function GET(req: NextRequest) {
  const userId = await getUserId()
  if (!userId) {
    return NextResponse.json({ error: "Sign in to view your notifications." }, { status: 401 })
  }

  try {
    const db = await getDBFromContext()
    const rows = await db
      .select()
      .from(notifications)
      .where(eq(notifications.userId, userId))
      .orderBy(desc(notifications.createdAt))
      .limit(LIST_LIMIT)

    // Counted off the fetched page rather than a separate `count(*)` query —
    // unread notifications are always among the most recent ones (nothing
    // un-reads a notification), so this only undercounts in the edge case of
    // more than `LIST_LIMIT` unread notifications at once, an acceptable
    // tradeoff for a badge count.
    const unreadCount = rows.filter((row: { readAt: Date | null }) => !row.readAt).length

    return NextResponse.json({ notifications: rows, unreadCount })
  } catch (error) {
    // Degrade to an empty feed instead of a raw 500 — e.g. right after a
    // deploy that hasn't run its D1 migration yet, so the `notifications`
    // table doesn't exist there. Same fallback shape /api/videos uses.
    // That specific case is expected and self-resolves once the migration
    // runs, so it's logged as a warning rather than an error to avoid
    // paging on a known, non-actionable condition.
    logNotificationsDBError("Failed to load notifications", error)
    return NextResponse.json({ notifications: [], unreadCount: 0 })
  }
}

export async function PATCH(req: NextRequest) {
  const userId = await getUserId()
  if (!userId) {
    return NextResponse.json({ error: "Sign in to update your notifications." }, { status: 401 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 })
  }

  const { id, all } = (body ?? {}) as { id?: unknown; all?: unknown }

  if (all !== true && typeof id !== "number" && typeof id !== "string") {
    return NextResponse.json({ error: "Provide a notification id or { all: true }." }, { status: 400 })
  }
  const notificationId = all === true ? null : Number(id)
  if (notificationId !== null && !Number.isInteger(notificationId)) {
    return NextResponse.json({ error: "Invalid notification id." }, { status: 400 })
  }

  try {
    const db = await getDBFromContext()
    const now = new Date()

    if (all === true) {
      await db
        .update(notifications)
        .set({ readAt: now })
        .where(and(eq(notifications.userId, userId), isNull(notifications.readAt)))
      return NextResponse.json({ ok: true })
    }

    await db
      .update(notifications)
      .set({ readAt: now })
      .where(and(eq(notifications.id, notificationId as number), eq(notifications.userId, userId)))

    return NextResponse.json({ ok: true })
  } catch (error) {
    logNotificationsDBError("Failed to update notifications", error)
    return NextResponse.json({ error: "Failed to update notifications." }, { status: 500 })
  }
}
