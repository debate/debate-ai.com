import { NextResponse } from "next/server"
import { eq, sql } from "drizzle-orm"
import { getDBFromContext } from "@/lib/database/context"
import { ensureTableColumns } from "@/lib/database/ensure-columns"
import { userSettings } from "@/lib/database/schema"
import { getUserId } from "@/lib/auth/session"

/**
 * The first-sign-in welcome dialog's account flag
 * (`user_settings.welcome_dismissed_at`).
 *
 * GET  — `{ dismissed: boolean }` for the signed-in user.
 * POST — records the welcome as dismissed (idempotent: the first
 *        timestamp is kept) and answers `{ dismissed: true }`.
 *
 * Kept off the generic `/api/settings` PUT: the flag is one-way and has no
 * client-side value worth validating, and reading it should not cost the
 * full settings payload on every first page load.
 */

export async function GET() {
  const userId = await getUserId()
  if (!userId) {
    return NextResponse.json({ error: "Sign in to load your account settings." }, { status: 401 })
  }

  const db = await getDBFromContext()
  await ensureTableColumns(db, userSettings)
  const [row] = await db
    .select({ welcomeDismissedAt: userSettings.welcomeDismissedAt })
    .from(userSettings)
    .where(eq(userSettings.userId, userId))
    .limit(1)

  return NextResponse.json({ dismissed: !!row?.welcomeDismissedAt })
}

export async function POST() {
  const userId = await getUserId()
  if (!userId) {
    return NextResponse.json({ error: "Sign in to save your account settings." }, { status: 401 })
  }

  const db = await getDBFromContext()
  await ensureTableColumns(db, userSettings)
  const now = new Date()
  await db
    .insert(userSettings)
    .values({ userId, welcomeDismissedAt: now })
    .onConflictDoUpdate({
      target: userSettings.userId,
      set: {
        welcomeDismissedAt: sql`coalesce(${userSettings.welcomeDismissedAt}, ${Math.floor(now.getTime() / 1000)})`,
        updatedAt: now,
      },
    })

  return NextResponse.json({ dismissed: true })
}
