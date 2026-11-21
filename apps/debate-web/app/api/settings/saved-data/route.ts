import { NextRequest, NextResponse } from "next/server"
import { getDBFromContext } from "@/lib/database/context"
import { getSession, getUserId } from "@/lib/auth/session"
import { loadOwnSavedData } from "@/lib/saved-data/saved-data"
import { exportAllOwnSavedData, exportOwnToolCollection } from "@/lib/saved-data/saved-data-items"
import { MAX_RESTORE_FILE_CHARS, parseRestoreFile, restoreOwnSavedData } from "@/lib/saved-data/saved-data-restore"

/**
 * GET — per-kind counts of the signed-in user's work saved in SQL (documents,
 * flows, rounds, debates…). Counts only, never content. Requires a session,
 * like the rest of `/api/settings`.
 *     ?export=all — instead downloads every saved item with its content as one JSON file.
 *     The archive also carries the caller's synced tool data (`toolRecords`).
 *     ?export=tool&collection=<key> — downloads one tool's synced data, in the
 *     same shape (only that collection), so Restore reads it back. 400 for a
 *     key that is not a synced tool collection.
 * POST — restores documents, flows, rounds, practice debates vs AI, word-count
 *     rounds, drill sets, judge decisions, sent speeches and tool data from an
 *     export file (the body is the file's JSON, single item or "Export all").
 *     Only adds rows; items still in the account are skipped. Answers
 *     `{ restored, restoredToolRecords, skipped }`.
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
  if (req.nextUrl.searchParams.get("export") === "tool") {
    const file = await exportOwnToolCollection(db, userId, req.nextUrl.searchParams.get("collection") ?? "")
    if (!file) return NextResponse.json({ error: "That isn't a tool that saves to your account." }, { status: 400 })
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
  return NextResponse.json(await restoreOwnSavedData(db, userId, parsed.entries, { author: session?.user?.name || null, email: session?.user?.email || "", toolRecords: parsed.toolRecords }))
}
