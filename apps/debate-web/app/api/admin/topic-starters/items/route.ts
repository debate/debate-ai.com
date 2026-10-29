/**
 * @fileoverview Moderator/admin-only: add one already-converted file to the public
 * Topic Starters catalogue.
 *
 * The sibling importer (`../route.ts`) takes a `.docx` or `.zip` and converts
 * it. This takes a file that is already in the app — one of the admin's own
 * sidebar files, dragged from Files onto Topic Starters — and copies its
 * stored content as-is, so a `.cmir` stays a `.cmir` and nothing is
 * re-converted. Readers who aren't staff submit through
 * `/api/topic-starters/changes`, where the file waits for a moderator.
 *
 * @module app/api/admin/topic-starters/items/route
 */
import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { normalizeFormat } from "@debate-ai/reason-docs/lib/debate-editor/format";
import { getStaffAccess } from "@/lib/auth/admin";
import { getDBFromContext } from "@/lib/database/context";
import { topicStarterItems } from "@/lib/database/schema";
import { ensureTopicStarterColumns } from "@/lib/topic-starters/changes";

export async function POST(request: NextRequest) {
  const { canEditContent } = await getStaffAccess();
  if (!canEditContent) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let body: { title?: string; content?: string; format?: string; parentId?: number | null; year?: number | null; isFolder?: boolean; tags?: string | string[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Expected a JSON body." }, { status: 400 });
  }
  const title = body.title?.trim();
  if (!title) return NextResponse.json({ error: "A title is required." }, { status: 400 });

  const db = await getDBFromContext();
  await ensureTopicStarterColumns(db);
  const parentId = typeof body.parentId === "number" ? body.parentId : null;
  if (parentId != null) {
    // Filed only under a real catalogue folder, so the row can't be orphaned
    // under a file or a deleted folder and vanish from the tree.
    const [parent] = await db
      .select({ id: topicStarterItems.id })
      .from(topicStarterItems)
      .where(and(eq(topicStarterItems.id, parentId), eq(topicStarterItems.isFolder, true)))
      .limit(1);
    if (!parent) return NextResponse.json({ error: "That Topic Starters folder no longer exists." }, { status: 400 });
  }

  const isFolder = body.isFolder === true;
  if (isFolder) {
    const [item] = await db
      .insert(topicStarterItems)
      .values({
        title,
        content: "",
        format: "html",
        parentId,
        isFolder: true,
        tags: Array.isArray(body.tags) ? JSON.stringify(body.tags) : (body.tags && typeof body.tags === "string" ? body.tags : JSON.stringify(["folder"])),
        published: true,
        year: null,
      })
      .returning();
    if (!item) return NextResponse.json({ error: "The folder could not be saved." }, { status: 500 });
    return NextResponse.json({ item }, { status: 201 });
  }

  const format = normalizeFormat(body.format);
  const year = parseTopicStarterYear(body.year);
  const [item] = await db
    .insert(topicStarterItems)
    .values({
      title,
      content: body.content ?? "",
      format,
      parentId,
      isFolder: false,
      tags: Array.isArray(body.tags) ? JSON.stringify(body.tags) : JSON.stringify([format, "public"]),
      published: true,
      year,
    })
    .returning();
  if (!item) return NextResponse.json({ error: "The file could not be saved." }, { status: 500 });
  return NextResponse.json({ item }, { status: 201 });
}

/**
 * The competition year a body names, or `null` when it names none. Mirrors
 * the importer's parser so an item added here is grouped the same way.
 */
function parseTopicStarterYear(raw: number | string | null | undefined): number | null {
  if (raw == null) return null
  const year = typeof raw === "number" ? raw : Number(String(raw).trim())
  if (!Number.isInteger(year) || year < 1900 || year > 2100) return null
  return year
}
