import { NextRequest, NextResponse } from "next/server"
import { getDBFromContext } from "@/lib/database/context"
import { getUserId } from "@/lib/auth/session"
import { deleteOwnSavedItem, exportOwnSavedItem, isItemKind, listOwnSavedItems } from "@/lib/saved-data/saved-data-items"

/**
 * GET    — titles of the signed-in user's saved docs / flows / rounds /
 *          practiceRounds, newest first (no content).
 * GET ?id=<n> — one of the caller's own rows with its full content, as a JSON
 *          download; 404 if it isn't theirs.
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
    const exported = await exportOwnSavedItem(db, userId, kind, id)
    if (!exported) return NextResponse.json({ error: "Saved item not found." }, { status: 404 })
    return new NextResponse(exported.body, {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="${exported.filename}"`,
        "Cache-Control": "private, no-store",
      },
    })
  }
  return NextResponse.json({ items: await listOwnSavedItems(db, userId, kind) })
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
