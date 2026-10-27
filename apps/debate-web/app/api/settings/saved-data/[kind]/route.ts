import { NextRequest, NextResponse } from "next/server"
import { getDBFromContext } from "@/lib/database/context"
import { getUserId } from "@/lib/auth/session"
import { deleteOwnSavedItem, exportOwnSavedItem, MAX_ITEMS, isItemKind, listOwnSavedItemsPage } from "@/lib/saved-data/saved-data-items"

/**
 * GET    — titles of the signed-in user's saved docs / flows / rounds /
 *          practiceRounds, newest first (no content).
 *        ?offset=<n>&limit=<n> — page through them; the response carries `hasMore`.
 *        ?id=<n> — instead downloads that one row's full content as JSON; 404 if it isn't theirs.
 * DELETE ?id=<n> — removes one of the caller's own rows; 404 if it isn't theirs.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ kind: string }> }) {
  const { kind } = await params
  if (!isItemKind(kind)) return NextResponse.json({ error: "Unknown kind." }, { status: 404 })
  const userId = await getUserId()
  if (!userId) return NextResponse.json({ error: "Sign in to see what is saved to your account." }, { status: 401 })
  const db = await getDBFromContext()
  const rawId = req.nextUrl.searchParams.get("id")
  if (rawId !== null) {
    const id = Number(rawId)
    if (!Number.isInteger(id)) return NextResponse.json({ error: "Invalid id." }, { status: 400 })
    const file = await exportOwnSavedItem(db, userId, kind, id)
    if (!file) return NextResponse.json({ error: "Saved item not found." }, { status: 404 })
    return new NextResponse(file.body, {
      headers: { "Content-Type": "application/json", "Content-Disposition": `attachment; filename="${file.filename}"` },
    })
  }
  const offset = Number(req.nextUrl.searchParams.get("offset") ?? 0)
  const limit = Number(req.nextUrl.searchParams.get("limit") ?? MAX_ITEMS)
  if (!Number.isInteger(offset) || offset < 0 || !Number.isInteger(limit) || limit < 1 || limit > MAX_ITEMS) {
    return NextResponse.json({ error: "Invalid offset or limit." }, { status: 400 })
  }
  return NextResponse.json(await listOwnSavedItemsPage(db, userId, kind, limit, offset))
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ kind: string }> }) {
  const { kind } = await params
  if (!isItemKind(kind)) return NextResponse.json({ error: "Unknown kind." }, { status: 404 })
  const id = Number(req.nextUrl.searchParams.get("id"))
  if (!Number.isInteger(id)) return NextResponse.json({ error: "Invalid id." }, { status: 400 })
  const userId = await getUserId()
  if (!userId) return NextResponse.json({ error: "Sign in to manage your saved data." }, { status: 401 })
  const db = await getDBFromContext()
  if (!(await deleteOwnSavedItem(db, userId, kind, id))) {
    return NextResponse.json({ error: "Saved item not found." }, { status: 404 })
  }
  return NextResponse.json({ ok: true })
}
