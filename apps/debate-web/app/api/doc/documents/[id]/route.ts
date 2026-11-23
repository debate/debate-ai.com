import { NextRequest, NextResponse } from "next/server"
import { eq } from "drizzle-orm"
import { getDBFromContext } from "@/lib/database/context"
import { documents } from "@/lib/database/schema"
import { getUserId } from "@/lib/auth/session"
import { slugifySegment } from "@debate-ai/reason-docs/lib/reason-docs/doc-path"
import type { FileStats } from "@debate-ai/reason-docs/lib/file-stats/file-stats"
import { ensureDocumentColumns, fileStatColumns } from "@/lib/file-stats/columns"
import { checkDocumentParent, parseDocumentPatch } from "@debate-ai/reason-docs/lib/reason-docs/doc-parent"
import { loadDocumentTreeRow } from "@/lib/api/document-tree"

/**
 * REASON editor single-document CRUD. Ported from quick search's
 * /api/doc/documents/[id], adapted to debate-ai.com's D1 binding and auth.
 * A PUT that changes the content recounts the file's size stats (quotes,
 * blocks, pages, characters) in the same write.
 *
 * A PUT that moves the file (`parentId`) is checked first
 * (`checkDocumentParent`): the new parent must be one of the owner's own
 * folders and not the file itself or one of its sub-folders, or the file
 * would drop out of the sidebar's tree. Such a move answers 400 and nothing
 * is written. Field types are checked too (`parseDocumentPatch`).
 */

/** The `[id]` segment as a row id, or null when it isn't one. */
function parseDocumentId(raw: string): number | null {
  const id = Number(raw)
  return Number.isSafeInteger(id) && id > 0 ? id : null
}

async function loadOwned(id: number, userId: string | null) {
  const db = await getDBFromContext()
  await ensureDocumentColumns(db)
  const [doc] = await db.select().from(documents).where(eq(documents.id, id)).limit(1)
  if (!doc) return { db, doc: null, forbidden: false }
  if (doc.userId && doc.userId !== userId) return { db, doc, forbidden: true }
  return { db, doc, forbidden: false }
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const id = parseDocumentId((await params).id)
  if (id === null) return NextResponse.json({ error: "Document not found" }, { status: 404 })
  const userId = await getUserId()
  const { doc, forbidden } = await loadOwned(id, userId)

  if (!doc) return NextResponse.json({ error: "Document not found" }, { status: 404 })
  if (forbidden) return NextResponse.json({ error: "Unauthorized" }, { status: 403 })

  return NextResponse.json(doc)
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const id = parseDocumentId((await params).id)
  if (id === null) return NextResponse.json({ error: "Document not found" }, { status: 404 })
  const userId = await getUserId()
  const { db, doc, forbidden } = await loadOwned(id, userId)

  if (!doc) return NextResponse.json({ error: "Document not found" }, { status: 404 })
  if (forbidden) return NextResponse.json({ error: "Unauthorized" }, { status: 403 })

  let raw: unknown
  try {
    raw = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 })
  }
  const parsed = parseDocumentPatch(raw)
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 })
  const body = parsed.patch

  // Only a real move is checked: re-sending the parent the row already has
  // (a queued patch merged with others) is always allowed.
  if (body.parentId !== undefined && body.parentId !== (doc.parentId ?? null)) {
    const check = await checkDocumentParent({ id, parentId: body.parentId, ownerId: doc.userId ?? null }, (rowId) =>
      loadDocumentTreeRow(db, rowId),
    )
    if (!check.ok) return NextResponse.json({ error: check.error }, { status: 400 })
  }

  const update: Partial<FileStats> & {
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
  if (body.content !== undefined) {
    update.content = body.content
    if (!doc.isFolder) Object.assign(update, await fileStatColumns(body.content, doc.format))
  }
  if (body.parentId !== undefined) update.parentId = body.parentId

  const [updated] = await db
    .update(documents)
    .set(update)
    .where(eq(documents.id, id))
    .returning()

  return NextResponse.json(updated)
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const id = parseDocumentId((await params).id)
  if (id === null) return NextResponse.json({ error: "Document not found" }, { status: 404 })
  const userId = await getUserId()
  const { db, doc, forbidden } = await loadOwned(id, userId)

  if (!doc) return NextResponse.json({ error: "Document not found" }, { status: 404 })
  if (forbidden) return NextResponse.json({ error: "Unauthorized" }, { status: 403 })

  await db.delete(documents).where(eq(documents.id, id))

  return NextResponse.json({ success: true })
}
