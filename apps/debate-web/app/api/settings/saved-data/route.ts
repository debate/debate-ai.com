import { NextRequest, NextResponse } from "next/server"
import { getDBFromContext } from "@/lib/database/context"
import { getSession, getUserId } from "@/lib/auth/session"
import { loadOwnSavedData } from "@/lib/saved-data/saved-data"
import { exportAllOwnSavedData } from "@/lib/saved-data/saved-data-items"
import { MAX_RESTORE_FILE_CHARS, parseRestoreFile, restoreOwnSavedData } from "@/lib/saved-data/saved-data-restore"

/**
 * GET — per-kind counts of the signed-in user's work saved in SQL (documents,
 * flows, rounds, debates…). Counts only, never content. Requires a session,
 * like the rest of `/api/settings`.
 *     ?export=all — instead downloads every saved item with its content as one JSON file.
 * POST — restores documents, flows and rounds from an export file (the body is
 *     the file's JSON, single item or "Export all"). Only adds rows; items still
 *     in the account are skipped. Answers `{ restored, skipped }`.
 */
export async function GET(req: NextRequest) {
  const userId = await getUserId()
  if (!userId) {
    return NextResponse.json({ error: "Sign in to see what is saved to your account." }, { status: 401 })
  }
  const db = await getDBFromContext()
  if (req.nextUrl.searchParams.get("export") === "all") {
    const file = await exportAllOwnSavedData(db, userId)
    return new NextResponse(file.body, {
      headers: { "Content-Type": "application/json", "Content-Disposition": `attachment; filename="${file.filename}"` },
    })
  }
  return NextResponse.json(await loadOwnSavedData(db, userId))
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  const userId = session?.user?.id
  if (!userId) {
    return NextResponse.json({ error: "Sign in to restore saved data to your account." }, { status: 401 })
  }
  const text = await req.text()
  if (text.length > MAX_RESTORE_FILE_CHARS) {
    return NextResponse.json({ error: "This export file is too large to restore at once." }, { status: 413 })
  }
  let value: unknown
  try {
    value = JSON.parse(text)
  } catch {
    return NextResponse.json({ error: "This file isn't valid JSON." }, { status: 400 })
  }
  const parsed = parseRestoreFile(value)
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 })
  const db = await getDBFromContext()
  return NextResponse.json(await restoreOwnSavedData(db, userId, parsed.entries, { author: session?.user?.name || null }))
}
