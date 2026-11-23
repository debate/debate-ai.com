import { NextRequest, NextResponse } from "next/server"
import { desc, eq, isNull } from "drizzle-orm"
import { getDBFromContext } from "@/lib/database/context"
import { documents } from "@/lib/database/schema"
import { getSession, getUserIdOrUnavailable } from "@/lib/auth/session"
import { withRouteErrors } from "@/lib/api/route-errors"
import { normalizeFormat } from "@debate-ai/reason-docs/lib/debate-editor/format"
import { ensureDocumentColumns, fileStatColumns } from "@/lib/file-stats/columns"
import { checkDocumentParent, parseDocumentPatch } from "@debate-ai/reason-docs/lib/reason-docs/doc-parent"
import { loadDocumentTreeRow } from "@/lib/api/document-tree"

/**
 * REASON editor document collection. GET lists documents for the current
 * user (or anonymous/local documents when signed out). POST creates one —
 * either a blank document (HTML) or an uploaded file the sidebar has already
 * converted to Debate Editor's native `.cmir` (`format: "cmir"`).
 * Ported from quick search's /api/doc/documents, adapted to debate-ai.com's
 * D1 binding and auth session helpers.
 *
 * Every file row also carries its author and size stats (quotes, blocks,
 * pages, characters — `lib/file-stats/columns.ts`), counted here on create
 * and by `[id]` on every content save.
 */

export const GET = withRouteErrors("GET /api/doc/documents", async (_req: NextRequest) => {
  const db = await getDBFromContext()
  // Not `getUserId`: a failed session lookup reads as signed out there, which
  // would hand a signed-in user the anonymous documents instead of their own.
  // Failing it is a 503 the sidebar retries (withRouteErrors).
  const userId = await getUserIdOrUnavailable()
  await ensureDocumentColumns(db)

  const rows = await db
    .select()
    .from(documents)
    .where(userId ? eq(documents.userId, userId) : isNull(documents.userId))
    .orderBy(desc(documents.updatedAt))

  return NextResponse.json(rows)
})

export async function POST(req: NextRequest) {
  const db = await getDBFromContext()
  const session = await getSession()
  const userId = session?.user?.id ?? null
  await ensureDocumentColumns(db)

  let body: {
    title?: string
    content?: string
    format?: string
    parentId?: number | null
    isFolder?: boolean
    /** The original author, when the file is a copy of someone else's (a
     *  Topic Starter saved to My Files). Defaults to the signed-in user. */
    author?: string | null
  }
  try {
    body = await req.json()
  } catch {
    body = {}
  }

  // The same type checks as a PUT (a non-string title used to throw on
  // `.trim()` and answer a bodiless 500).
  const parsed = parseDocumentPatch(body)
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 })
  const parentId = parsed.patch.parentId ?? null
  const check = await checkDocumentParent({ parentId, ownerId: userId }, (rowId) => loadDocumentTreeRow(db, rowId))
  if (!check.ok) return NextResponse.json({ error: check.error }, { status: 400 })

  const isFolder = body.isFolder === true
  const format = normalizeFormat(body.format)
  const content = parsed.patch.content ?? ""
  const author = (typeof body.author === "string" && body.author.trim().slice(0, 200)) || session?.user?.name || null
  const [created] = await db
    .insert(documents)
    .values({
      title: parsed.patch.title?.trim() || (isFolder ? "New Folder" : "Untitled"),
      content,
      // Narrowed rather than trusted: an unrecognized value would make the
      // row unreadable, since `format` is what tells a reader whether to
      // gunzip the column or hand it to the editor as markup.
      format,
      userId,
      parentId,
      isFolder,
      author: isFolder ? null : author,
      ...(isFolder ? {} : await fileStatColumns(content, format)),
    })
    .returning()

  return NextResponse.json(created, { status: 201 })
}
