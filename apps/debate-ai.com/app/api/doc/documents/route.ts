import { NextRequest, NextResponse } from "next/server"
import { desc, eq, isNull } from "drizzle-orm"
import { getDBFromContext } from "@/lib/database/context"
import { documents } from "@/lib/database/schema"
import { getUserId } from "@/lib/auth/session"

/**
 * REASON editor document collection. GET lists documents for the current
 * user (or anonymous/local documents when signed out). POST creates one.
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

  let body: { title?: string; content?: string }
  try {
    body = await req.json()
  } catch {
    body = {}
  }

  const [created] = await db
    .insert(documents)
    .values({
      title: body.title?.trim() || "Untitled",
      content: body.content ?? "",
      userId,
    })
    .returning()

  return NextResponse.json(created, { status: 201 })
}
