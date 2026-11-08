import { NextRequest, NextResponse } from "next/server"
import { desc, eq, isNull } from "drizzle-orm"
import { getDBFromContext } from "@/lib/database/context"
import { documents } from "@/lib/database/schema"
import { getSession, getUserId } from "@/lib/auth/session"
import { normalizeFormat } from "@debate-ai/reason-docs/lib/debate-editor/format"
import { ensureDocumentColumns, fileStatColumns } from "@/lib/file-stats/columns"

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

export async function GET(req: NextRequest) {
  const db = await getDBFromContext()
  const userId = await getUserId()
  await ensureDocumentColumns(db)

  const rows = await db
    .select()
    .from(documents)
    .where(userId ? eq(documents.userId, userId) : isNull(documents.userId))
    .orderBy(desc(documents.updatedAt))

  return NextResponse.json(rows)
}

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

  const isFolder = body.isFolder ?? false
  const format = normalizeFormat(body.format)
  const content = body.content ?? ""
  const author = (typeof body.author === "string" && body.author.trim().slice(0, 200)) || session?.user?.name || null
  const [created] = await db
    .insert(documents)
    .values({
      title: body.title?.trim() || (body.isFolder ? "New Folder" : "Untitled"),
      content,
      // Narrowed rather than trusted: an unrecognized value would make the
      // row unreadable, since `format` is what tells a reader whether to
      // gunzip the column or hand it to the editor as markup.
      format,
      userId,
      parentId: body.parentId ?? null,
      isFolder,
      author: isFolder ? null : author,
      ...(isFolder ? {} : await fileStatColumns(content, format)),
    })
    .returning()

  return NextResponse.json(created, { status: 201 })
}
