import { NextRequest, NextResponse } from "next/server"
import { desc, eq, isNull } from "drizzle-orm"
import { getDBFromContext } from "@/lib/database/context"
import { documents } from "@/lib/database/schema"
import { getUserId } from "@/lib/auth/session"
import { normalizeFormat } from "@/lib/cardmirror/format"

/**
 * REASON editor document collection. GET lists documents for the current
 * user (or anonymous/local documents when signed out). POST creates one —
 * either a blank document (HTML) or an uploaded file the sidebar has already
 * converted to CardMirror's native `.cmir` (`format: "cmir"`).
 * Ported from quick search's /api/doc/documents, adapted to debate-ai.com's
 * D1 binding and auth session helpers.
 */

export async function GET(req: NextRequest) {
  const db = await getDBFromContext()
  const userId = await getUserId()

  const rows = await db
    .select()
    .from(documents)
    .where(userId ? eq(documents.userId, userId) : isNull(documents.userId))
    .orderBy(desc(documents.updatedAt))

  return NextResponse.json(rows)
}

export async function POST(req: NextRequest) {
  const db = await getDBFromContext()
  const userId = await getUserId()

  let body: {
    title?: string
    content?: string
    format?: string
    parentId?: number | null
    isFolder?: boolean
  }
  try {
    body = await req.json()
  } catch {
    body = {}
  }

  const [created] = await db
    .insert(documents)
    .values({
      title: body.title?.trim() || (body.isFolder ? "New Folder" : "Untitled"),
      content: body.content ?? "",
      // Narrowed rather than trusted: an unrecognized value would make the
      // row unreadable, since `format` is what tells a reader whether to
      // gunzip the column or hand it to the editor as markup.
      format: normalizeFormat(body.format),
      userId,
      parentId: body.parentId ?? null,
      isFolder: body.isFolder ?? false,
    })
    .returning()

  return NextResponse.json(created, { status: 201 })
}
