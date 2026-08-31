import { NextRequest, NextResponse } from "next/server"
import { eq } from "drizzle-orm"
import { getDBFromContext } from "@/lib/database/context"
import { userSettings } from "@/lib/database/schema"
import { getUserId } from "@/lib/auth/session"
import { isValidSettingsData, MAX_SAVED_SETTINGS_BYTES } from "debate-round/src/state/savedSettings"

/**
 * Account-synced user settings (see `debate-round`'s
 * `state/settings.ts`/`state/savedSettings.ts`) — one JSON blob per user.
 *
 * GET  — `{ signedIn, data }`. `data` is `null` when signed out or nothing
 *   has been saved yet; never an error, since staying local-only is a
 *   normal, supported state.
 * PUT  { data } — upserts the caller's whole settings map. Requires a
 *   session, since there's no meaningful anonymous owner for this row.
 */

export async function GET(req: NextRequest) {
  const userId = await getUserId()
  if (!userId) {
    return NextResponse.json({ signedIn: false, data: null })
  }

  const db = await getDBFromContext()
  const [row] = await db
    .select()
    .from(userSettings)
    .where(eq(userSettings.userId, userId))
    .limit(1)

  if (!row) {
    return NextResponse.json({ signedIn: true, data: null })
  }

  let data: unknown = null
  try {
    data = JSON.parse(row.data)
  } catch {
    // Corrupt stored JSON: degrade to null rather than throw, matching this
    // repo's other stores' corrupt-storage-degrades-gracefully convention.
  }

  return NextResponse.json({ signedIn: true, data: isValidSettingsData(data) ? data : null })
}

export async function PUT(req: NextRequest) {
  const userId = await getUserId()
  if (!userId) {
    return NextResponse.json({ error: "Sign in to sync settings to your account." }, { status: 401 })
  }

  let body: { data?: unknown }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 })
  }

  if (!isValidSettingsData(body.data)) {
    return NextResponse.json(
      { error: `data must be an object of string/number/boolean values, at most ${MAX_SAVED_SETTINGS_BYTES} bytes.` },
      { status: 400 },
    )
  }

  const db = await getDBFromContext()
  const values = { userId, data: JSON.stringify(body.data), updatedAt: new Date() }

  await db
    .insert(userSettings)
    .values(values)
    .onConflictDoUpdate({ target: userSettings.userId, set: values })

  return NextResponse.json({ signedIn: true, data: body.data })
}
