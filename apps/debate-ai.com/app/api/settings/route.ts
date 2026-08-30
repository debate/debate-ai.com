import { NextRequest, NextResponse } from "next/server"
import { eq } from "drizzle-orm"
import { getDBFromContext } from "@/lib/database/context"
import { userSettings } from "@/lib/database/schema"
import { getUserId } from "@/lib/auth/session"
import { DEFAULT_USER_SETTINGS, normalizeUserSettingsPatch, type UserSettingsPayload } from "debate-round"

/**
 * Account-linked app preferences — TODO.md idea #17 ("User Settings —
 * account-linked debate preferences"), first slice. One `user_settings`
 * row per signed-in user, mirroring `debate-round`'s local-only `settings`
 * singleton so a user's `debateStyle`/`fontSize` choices follow them
 * across devices. Unlike `app/api/doc/documents/route.ts`, there is no
 * anonymous/signed-out mode here — settings are account data, so both
 * handlers require a session and return 401 without one; the client
 * (`UserSettingsPanel`) falls back to the local-only `settings` singleton
 * when signed out instead of calling this route.
 *
 * GET  — the current user's saved settings, or `DEFAULT_USER_SETTINGS`
 *   for any field with no saved row/value yet.
 * PUT  { debateStyle?, fontSize? } — validates and upserts the given
 *   fields (validated by `debate-round`'s `normalizeUserSettingsPatch`,
 *   the same option lists the picker UI itself uses), returning the
 *   resulting full settings row.
 */

function toPayload(row: { debateStyle: number | null; fontSize: number | null } | undefined): UserSettingsPayload {
  return {
    debateStyle: row?.debateStyle ?? DEFAULT_USER_SETTINGS.debateStyle,
    fontSize: row?.fontSize ?? DEFAULT_USER_SETTINGS.fontSize,
  }
}

export async function GET(req: NextRequest) {
  const userId = await getUserId()
  if (!userId) {
    return NextResponse.json({ error: "Sign in to load your account settings." }, { status: 401 })
  }

  const db = await getDBFromContext()
  const [row] = await db.select().from(userSettings).where(eq(userSettings.userId, userId)).limit(1)

  return NextResponse.json(toPayload(row))
}

export async function PUT(req: NextRequest) {
  const userId = await getUserId()
  if (!userId) {
    return NextResponse.json({ error: "Sign in to save your account settings." }, { status: 401 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 })
  }

  const { valid, errors } = normalizeUserSettingsPatch(body)
  if (errors.length > 0) {
    return NextResponse.json({ error: errors.join(" ") }, { status: 400 })
  }
  if (Object.keys(valid).length === 0) {
    return NextResponse.json({ error: "Provide at least one of debateStyle or fontSize." }, { status: 400 })
  }

  const db = await getDBFromContext()
  const now = new Date()

  await db
    .insert(userSettings)
    .values({ userId, ...valid, createdAt: now, updatedAt: now })
    .onConflictDoUpdate({ target: userSettings.userId, set: { ...valid, updatedAt: now } })

  const [row] = await db.select().from(userSettings).where(eq(userSettings.userId, userId)).limit(1)

  return NextResponse.json(toPayload(row))
}
