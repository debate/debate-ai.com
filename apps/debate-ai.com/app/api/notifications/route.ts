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

export async function GET(req: NextRequest) {
  const userId = await getUserId()
  if (!userId) {
    return NextResponse.json({ error: "Sign in to view your notifications." }, { status: 401 })
  }

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
  const db = await getDBFromContext()
  const now = new Date()

  if (all === true) {
    await db
      .update(notifications)
      .set({ readAt: now })
      .where(and(eq(notifications.userId, userId), isNull(notifications.readAt)))
    return NextResponse.json({ ok: true })
  }

  if (typeof id !== "number" && typeof id !== "string") {
    return NextResponse.json({ error: "Provide a notification id or { all: true }." }, { status: 400 })
  }
  const notificationId = Number(id)
  if (!Number.isInteger(notificationId)) {
    return NextResponse.json({ error: "Invalid notification id." }, { status: 400 })
  }

  await db
    .update(notifications)
    .set({ readAt: now })
    .where(and(eq(notifications.id, notificationId), eq(notifications.userId, userId)))

  return NextResponse.json({ ok: true })
}
