import { NextRequest, NextResponse } from "next/server"
import { getDBFromContext } from "@/lib/database/context"
import { getUserId } from "@/lib/auth/session"
import { loadOwnSavedData } from "@/lib/saved-data/saved-data"
import { exportAllOwnSavedData } from "@/lib/saved-data/saved-data-items"

/**
 * GET — per-kind counts of the signed-in user's work saved in SQL (documents,
 * flows, rounds, debates…). Counts only, never content. Requires a session,
 * like the rest of `/api/settings`.
 *     ?export=all — instead downloads every saved item with its content as one JSON file.
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
