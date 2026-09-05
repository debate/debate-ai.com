import { NextRequest, NextResponse } from "next/server"
import { eq, inArray } from "drizzle-orm"
import { getDBFromContext } from "@/lib/database/context"
import { topicStarterItems } from "@/lib/database/schema"
import { getUserId } from "@/lib/auth/session"
import {
  canManageSharedFile,
  canViewSharedFile,
  collectSharedFileDescendantIds,
  normalizeSharedFileTitle,
  validateSharedFilePayload,
} from "debate-round"

/**
 * Single shared-file CRUD (see `../route.ts` and
 * docs/features/shared-files.md).
 *
 * GET    — the row with content; 404 unless it's published or the
 *          viewer owns it.
 * PUT    — owner-only edit: title, content, tags, published, parentId.
 * DELETE — owner-only; a folder takes everything under it with it.
 */

function parseId(raw: string): number | null {
  const id = Number(raw)
  return Number.isInteger(id) && id > 0 ? id : null
}

async function load(id: number) {
  const db = await getDBFromContext()
  const [item] = await db.select().from(topicStarterItems).where(eq(topicStarterItems.id, id)).limit(1)
  return { db, item: item ?? null }
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const id = parseId((await params).id)
  if (id === null) return NextResponse.json({ error: "Invalid file id." }, { status: 400 })
  const userId = await getUserId()
  const { item } = await load(id)
  if (!item || !canViewSharedFile(item, userId)) return NextResponse.json({ error: "Shared file not found." }, { status: 404 })
  return NextResponse.json(item)
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const id = parseId((await params).id)
  if (id === null) return NextResponse.json({ error: "Invalid file id." }, { status: 400 })
  const userId = await getUserId()
  if (!userId) return NextResponse.json({ error: "Sign in to manage your shared files." }, { status: 401 })

  const { db, item } = await load(id)
  if (!item || !canViewSharedFile(item, userId)) return NextResponse.json({ error: "Shared file not found." }, { status: 404 })
  if (!canManageSharedFile(item, userId)) return NextResponse.json({ error: "Only the owner can edit this file." }, { status: 403 })

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 })
  }
  const validation = validateSharedFilePayload(body)
  if (!validation.ok) return NextResponse.json({ error: validation.error }, { status: 400 })
  const { payload } = validation

  const update: Partial<typeof topicStarterItems.$inferInsert> = { updatedAt: new Date() }
  if (payload.title !== undefined) update.title = normalizeSharedFileTitle(payload.title, item.isFolder)
  if (payload.content !== undefined && !item.isFolder) update.content = payload.content
  if (payload.tags !== undefined) update.tags = JSON.stringify(payload.tags)
  if (payload.published !== undefined) update.published = payload.published
  if (payload.parentId !== undefined) {
    if (payload.parentId !== null) {
      if (payload.parentId === id) return NextResponse.json({ error: "A folder can't be moved into itself." }, { status: 400 })
      const [parent] = await db.select().from(topicStarterItems).where(eq(topicStarterItems.id, payload.parentId)).limit(1)
      if (!parent || !parent.isFolder || parent.ownerId !== userId) {
        return NextResponse.json({ error: "The destination folder must be one of your own shared folders." }, { status: 400 })
      }
      if (item.isFolder) {
        const mine = await db.select({ id: topicStarterItems.id, parentId: topicStarterItems.parentId }).from(topicStarterItems).where(eq(topicStarterItems.ownerId, userId))
        if (collectSharedFileDescendantIds(mine, id).includes(payload.parentId)) {
          return NextResponse.json({ error: "A folder can't be moved into one of its own subfolders." }, { status: 400 })
        }
      }
    }
    update.parentId = payload.parentId
  }

  const [updated] = await db.update(topicStarterItems).set(update).where(eq(topicStarterItems.id, id)).returning()
  return NextResponse.json(updated)
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const id = parseId((await params).id)
  if (id === null) return NextResponse.json({ error: "Invalid file id." }, { status: 400 })
  const userId = await getUserId()
  if (!userId) return NextResponse.json({ error: "Sign in to manage your shared files." }, { status: 401 })

  const { db, item } = await load(id)
  if (!item || !canViewSharedFile(item, userId)) return NextResponse.json({ error: "Shared file not found." }, { status: 404 })
  if (!canManageSharedFile(item, userId)) return NextResponse.json({ error: "Only the owner can delete this file." }, { status: 403 })

  const mine = await db.select({ id: topicStarterItems.id, parentId: topicStarterItems.parentId }).from(topicStarterItems).where(eq(topicStarterItems.ownerId, userId))
  const ids = collectSharedFileDescendantIds(mine, id)
  await db.delete(topicStarterItems).where(inArray(topicStarterItems.id, ids))
  return NextResponse.json({ deleted: ids.length })
}
