import { NextRequest, NextResponse } from "next/server"
import { eq } from "drizzle-orm"
import { getDBFromContext } from "@/lib/database/context"
import { documents, topicStarterItems } from "@/lib/database/schema"
import { getUserId } from "@/lib/auth/session"
import { canViewSharedFile } from "debate-round"

/**
 * "Save a copy to my documents" — copies a shared file's content into the
 * viewer's own Reason Editor documents so they can edit it. Follows
 * `/api/doc/documents`' anonymous mode: signed out, the copy lands in the
 * browser-local (ownerless) document set, matching what the editor's
 * "New document" does when signed out.
 */
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id)
  if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ error: "Invalid file id." }, { status: 400 })

  const userId = await getUserId()
  const db = await getDBFromContext()
  const [item] = await db.select().from(topicStarterItems).where(eq(topicStarterItems.id, id)).limit(1)
  if (!item || !canViewSharedFile(item, userId)) return NextResponse.json({ error: "Shared file not found." }, { status: 404 })
  if (item.isFolder) return NextResponse.json({ error: "Copy a file, not a folder." }, { status: 400 })

  const [created] = await db
    .insert(documents)
    .values({ title: item.title, content: item.content, userId, parentId: null, isFolder: false })
    .returning({ id: documents.id, title: documents.title })
  return NextResponse.json(created, { status: 201 })
}
