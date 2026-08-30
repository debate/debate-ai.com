import { NextRequest, NextResponse } from "next/server"
import { eq } from "drizzle-orm"
import { getDBFromContext } from "@/lib/database/context"
import { userSettings } from "@/lib/database/schema"
import { requireUserId } from "@/lib/auth/session"

/**
 * Per-user settings row (see /settings). GET returns the caller's row, or
 * defaults if they've never saved one. PUT upserts by userId — every field is
 * optional so the settings page can PATCH-style save one control at a time.
 */

const DEFAULTS = { colorTheme: null as string | null, colorMode: null as string | null, defaultRoundPrivate: false }

export async function GET() {
  const userId = await requireUserId().catch(() => null)
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const db = await getDBFromContext()
  const [row] = await db.select().from(userSettings).where(eq(userSettings.userId, userId)).limit(1)

  return NextResponse.json(row ?? { userId, ...DEFAULTS })
}

export async function PUT(req: NextRequest) {
  const userId = await requireUserId().catch(() => null)
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  let body: { colorTheme?: string; colorMode?: string; defaultRoundPrivate?: boolean }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 })
  }

  const db = await getDBFromContext()

  const patch: Record<string, unknown> = { updatedAt: new Date() }
  if (body.colorTheme !== undefined) patch.colorTheme = body.colorTheme
  if (body.colorMode !== undefined) patch.colorMode = body.colorMode
  if (body.defaultRoundPrivate !== undefined) patch.defaultRoundPrivate = body.defaultRoundPrivate

  const values = { userId, ...DEFAULTS, ...patch }

  const [saved] = await db
    .insert(userSettings)
    .values(values)
    .onConflictDoUpdate({ target: userSettings.userId, set: patch })
    .returning()

  return NextResponse.json(saved)
}
