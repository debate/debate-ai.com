import { NextRequest, NextResponse } from "next/server"
import { asc, eq } from "drizzle-orm"
import { getDBFromContext } from "@/lib/database/context"
import { savedSpeechSendLog } from "@/lib/database/schema"
import { getUserId } from "@/lib/auth/session"

/**
 * Account-linked Speech Documents send-log sync (see `schema.ts`'s
 * `savedSpeechSendLog` comment). One row per generated
 * `SpeechSendLogEntry`, keyed by its own generated `id`. Same account-only
 * shape as `/api/judge-decisions` — no anonymous/signed-out mode, 401
 * without a session — since a synced entry only exists once explicitly
 * sent to the speech doc.
 *
 * GET — every one of the current user's synced entries, in full
 *   (`SpeechSendLogEntry[]`), oldest first (mirrors the local store's own
 *   insertion order) so `useSpeechSendLogSync`'s merge and
 *   `SpeechSendLogPanel` can both use this one call directly.
 */

export async function GET(req: NextRequest) {
  const userId = await getUserId()
  if (!userId) {
    return NextResponse.json({ error: "Sign in to view your synced speech-document history." }, { status: 401 })
  }

  const db = await getDBFromContext()
  const rows = await db
    .select({ data: savedSpeechSendLog.data })
    .from(savedSpeechSendLog)
    .where(eq(savedSpeechSendLog.userId, userId))
    .orderBy(asc(savedSpeechSendLog.createdAt))

  return NextResponse.json(rows.map((row: { data: string }) => JSON.parse(row.data)))
}
