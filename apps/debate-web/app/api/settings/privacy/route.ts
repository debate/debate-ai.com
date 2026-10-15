import { NextResponse } from "next/server"
import { validateRecordingPrivacyPatch } from "@debate/webview/lib/privacy/recording-release"
import { getDBFromContext } from "@/lib/database/context"
import { getRecordingPrivacy, saveRecordingPrivacy } from "@/lib/privacy/store"
import { getUserId } from "@/lib/auth/session"

/**
 * Settings → Privacy's recording release (`user_settings.recording_privacy`).
 *
 * GET — the signed-in user's `RecordingPrivacy` (defaults when unset).
 * PUT — a partial patch (`release`, `media`, `credit`, `realNameFormat`,
 *       `username`), validated by `validateRecordingPrivacyPatch`, which
 *       stamps the release version and time on agreement. Answers the
 *       stored value.
 *
 * Kept off the generic `/api/settings` PUT, like `/api/settings/welcome`:
 * publishers read this one value, and its agreement stamp is set here only.
 */

export async function GET() {
  const userId = await getUserId()
  if (!userId) {
    return NextResponse.json({ error: "Sign in to load your privacy settings." }, { status: 401 })
  }
  const db = await getDBFromContext()
  return NextResponse.json({ privacy: await getRecordingPrivacy(db, userId) })
}

export async function PUT(request: Request) {
  const userId = await getUserId()
  if (!userId) {
    return NextResponse.json({ error: "Sign in to save your privacy settings." }, { status: 401 })
  }
  const body = await request.json().catch(() => null)
  const db = await getDBFromContext()
  const previous = await getRecordingPrivacy(db, userId)
  const { value, errors } = validateRecordingPrivacyPatch(body, previous)
  if (errors.length > 0) {
    return NextResponse.json({ error: errors.join(" "), errors }, { status: 400 })
  }
  await saveRecordingPrivacy(db, userId, value)
  return NextResponse.json({ privacy: value })
}
