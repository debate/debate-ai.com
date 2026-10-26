import { NextRequest, NextResponse } from "next/server"
import { getDBFromContext } from "@/lib/database/context"
import { getUserId } from "@/lib/auth/session"
import { deleteOwnSavedItem, exportOwnSavedItem, isItemKind, listOwnSavedItemsPage } from "@/lib/saved-data/saved-data-items"

/**
 * GET    — titles of the signed-in user's saved docs / flows / rounds /
 *          practiceRounds, newest first (no content), as `{ items, hasMore }`;
 *          `?limit=` (1-100, default 25) and `?offset=` page through them.
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
  const limit = Number(req.nextUrl.searchParams.get("limit") ?? undefined)
  const offset = Number(req.nextUrl.searchParams.get("offset") ?? undefined)
  return NextResponse.json(await listOwnSavedItemsPage(db, userId, kind, { limit: Number.isFinite(limit) ? limit : undefined, offset: Number.isFinite(offset) ? offset : undefined }))
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
