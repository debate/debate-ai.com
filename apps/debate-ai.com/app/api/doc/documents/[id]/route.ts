import { NextRequest, NextResponse } from "next/server"
import { eq } from "drizzle-orm"
import { getDBFromContext } from "@/lib/database/context"
import { documents } from "@/lib/database/schema"
import { getUserId } from "@/lib/auth/session"
import { slugifySegment } from "debate-webview/lib/reason-docs/doc-path"

/**
 * REASON editor single-document CRUD. Ported from quick search's
 * /api/doc/documents/[id], adapted to debate-ai.com's D1 binding and auth.
 */

async function loadOwned(id: number, userId: string | null) {
  const db = await getDBFromContext()
  const [doc] = await db.select().from(documents).where(eq(documents.id, id)).limit(1)
  if (!doc) return { db, doc: null, forbidden: false }
  if (doc.userId && doc.userId !== userId) return { db, doc, forbidden: true }
  return { db, doc, forbidden: false }
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const userId = await getUserId()
  const { doc, forbidden } = await loadOwned(Number(id), userId)

  if (!doc) return NextResponse.json({ error: "Document not found" }, { status: 404 })
  if (forbidden) return NextResponse.json({ error: "Unauthorized" }, { status: 403 })

  return NextResponse.json(doc)
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const userId = await getUserId()
  const { db, doc, forbidden } = await loadOwned(Number(id), userId)

  if (!doc) return NextResponse.json({ error: "Document not found" }, { status: 404 })
  if (forbidden) return NextResponse.json({ error: "Unauthorized" }, { status: 403 })

  let body: { title?: string; content?: string; parentId?: number | null }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 })
  }

  const update: {
    title?: string
    content?: string
    parentId?: number | null
    previousSlug?: string | null
    updatedAt: Date
  } = {
    updatedAt: new Date(),
  }
  if (body.title !== undefined) {
    const nextTitle = body.title.trim() || "Untitled"
    if (nextTitle !== doc.title) {
      const oldSlug = slugifySegment(doc.title)
      // Only worth remembering when the slug actually moved — a
      // capitalization/punctuation-only edit still resolves the old link as
      // the current one, and an old title with nothing sluggable in it
      // (`findItemByRef`'s row-id fallback) has no slug worth redirecting from.
      if (oldSlug && oldSlug !== slugifySegment(nextTitle)) update.previousSlug = oldSlug
    }
    update.title = nextTitle
  }
  if (body.content !== undefined) update.content = body.content
  if (body.parentId !== undefined) update.parentId = body.parentId

  const [updated] = await db
    .update(documents)
    .set(update)
    .where(eq(documents.id, Number(id)))
    .returning()

  return NextResponse.json(updated)
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const userId = await getUserId()
  const { db, doc, forbidden } = await loadOwned(Number(id), userId)

  if (!doc) return NextResponse.json({ error: "Document not found" }, { status: 404 })
  if (forbidden) return NextResponse.json({ error: "Unauthorized" }, { status: 403 })

  await db.delete(documents).where(eq(documents.id, Number(id)))

  return NextResponse.json({ success: true })
}
