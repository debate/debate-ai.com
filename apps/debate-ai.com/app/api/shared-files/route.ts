import { NextRequest, NextResponse } from "next/server"
import { and, asc, eq, or } from "drizzle-orm"
import { getDBFromContext } from "@/lib/database/context"
import { documents, topicStarterItems } from "@/lib/database/schema"
import { getUserId } from "@/lib/auth/session"
import {
  normalizeSharedFileTitle,
  validateSharedFilePayload,
  type SharedFilePayload,
} from "debate-round"

/**
 * Shared-file library — the user-facing read/write API over the
 * `topic_starter_items` table (see docs/features/shared-files.md). Admin
 * "Topic Starter" packs (no owner) and files users share from their own
 * accounts live side by side; only an owner can change or remove their
 * rows, and an unpublished row is visible to its owner alone.
 *
 * GET  ?scope=public (default) — every published row, from any owner.
 *      ?scope=mine             — the current user's rows, published or
 *                                not (401 when signed out).
 *      ?scope=all              — both, for `/library`'s one-shot load.
 * POST — create a shared file/folder. Either a full payload
 *      (`{ title, content, tags, published, parentId, isFolder }`) or
 *      `{ documentId, published?, tags?, parentId? }` to publish one of
 *      the user's own Reason Editor documents; re-sharing the same
 *      document updates its existing shared copy (`sourceDocumentId`).
 *      Requires a session.
 */

const sortRows = [asc(topicStarterItems.isFolder), asc(topicStarterItems.title)]

export async function GET(req: NextRequest) {
  const scope = req.nextUrl.searchParams.get("scope") ?? "public"
  const userId = await getUserId()
  const db = await getDBFromContext()

  if (scope === "mine") {
    if (!userId) return NextResponse.json({ error: "Sign in to view your shared files." }, { status: 401 })
    const items = await db.select().from(topicStarterItems).where(eq(topicStarterItems.ownerId, userId)).orderBy(...sortRows)
    return NextResponse.json({ items })
  }

  const visible = userId
    ? or(eq(topicStarterItems.published, true), eq(topicStarterItems.ownerId, userId))
    : eq(topicStarterItems.published, true)
  const items = await db
    .select()
    .from(topicStarterItems)
    .where(scope === "all" ? visible : eq(topicStarterItems.published, true))
    .orderBy(...sortRows)
  return NextResponse.json({ items })
}

export async function POST(req: NextRequest) {
  const userId = await getUserId()
  if (!userId) return NextResponse.json({ error: "Sign in to share files." }, { status: 401 })

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 })
  }

  const validation = validateSharedFilePayload(body)
  if (!validation.ok) return NextResponse.json({ error: validation.error }, { status: 400 })
  const payload: SharedFilePayload = validation.payload
  const db = await getDBFromContext()

  // A parent must be one of the user's own folders.
  if (payload.parentId != null) {
    const [parent] = await db.select().from(topicStarterItems).where(eq(topicStarterItems.id, payload.parentId)).limit(1)
    if (!parent || !parent.isFolder || parent.ownerId !== userId) {
      return NextResponse.json({ error: "The destination folder must be one of your own shared folders." }, { status: 400 })
    }
  }

  const documentId = (body as { documentId?: unknown }).documentId
  if (documentId !== undefined) {
    if (!Number.isInteger(documentId)) return NextResponse.json({ error: "\"documentId\" must be an integer." }, { status: 400 })
    const [doc] = await db.select().from(documents).where(eq(documents.id, documentId as number)).limit(1)
    if (!doc || doc.userId !== userId) return NextResponse.json({ error: "Document not found." }, { status: 404 })
    if (doc.isFolder) return NextResponse.json({ error: "Share a document, not a folder." }, { status: 400 })

    const values = {
      title: normalizeSharedFileTitle(payload.title ?? doc.title),
      content: doc.content,
      published: payload.published ?? true,
      tags: JSON.stringify(payload.tags ?? ["shared"]),
      updatedAt: new Date(),
    }
    const [existing] = await db
      .select()
      .from(topicStarterItems)
      .where(and(eq(topicStarterItems.ownerId, userId), eq(topicStarterItems.sourceDocumentId, doc.id)))
      .limit(1)
    if (existing) {
      const [updated] = await db
        .update(topicStarterItems)
        .set({ ...values, ...(payload.parentId !== undefined ? { parentId: payload.parentId } : {}) })
        .where(eq(topicStarterItems.id, existing.id))
        .returning()
      return NextResponse.json(updated)
    }
    const [created] = await db
      .insert(topicStarterItems)
      .values({ ...values, ownerId: userId, sourceDocumentId: doc.id, parentId: payload.parentId ?? null, isFolder: false })
      .returning()
    return NextResponse.json(created, { status: 201 })
  }

  const isFolder = payload.isFolder ?? false
  const [created] = await db
    .insert(topicStarterItems)
    .values({
      title: normalizeSharedFileTitle(payload.title, isFolder),
      content: isFolder ? "" : payload.content ?? "",
      parentId: payload.parentId ?? null,
      isFolder,
      tags: JSON.stringify(payload.tags ?? (isFolder ? ["folder"] : ["shared"])),
      published: payload.published ?? true,
      ownerId: userId,
    })
    .returning()
  return NextResponse.json(created, { status: 201 })
}

