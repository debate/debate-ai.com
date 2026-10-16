/**
 * @fileoverview Admin-only: add one already-converted file to the public
 * Topic Starters catalogue.
 *
 * The sibling importer (`../route.ts`) takes a `.docx` or `.zip` and converts
 * it. This takes a file that is already in the app — one of the admin's own
 * sidebar files, dragged from Files onto Topic Starters — and copies its
 * stored content as-is, so a `.cmir` stays a `.cmir` and nothing is
 * re-converted.
 *
 * @module app/api/admin/topic-starters/items/route
 */
import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { normalizeFormat } from "@debate/webview/lib/cardmirror/format";
import { getAdminAccess } from "@/lib/auth/admin";
import { getDBFromContext } from "@/lib/database/context";
import { topicStarterItems } from "@/lib/database/schema";

export async function POST(request: NextRequest) {
  const { isAdmin } = await getAdminAccess();
  if (!isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let body: { title?: string; content?: string; format?: string; parentId?: number | null };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Expected a JSON body." }, { status: 400 });
  }
  const title = body.title?.trim();
  if (!title) return NextResponse.json({ error: "A title is required." }, { status: 400 });

  const db = await getDBFromContext();
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

  const format = normalizeFormat(body.format);
  const [item] = await db
    .insert(topicStarterItems)
    .values({
      title,
      content: body.content ?? "",
      format,
      parentId,
      isFolder: false,
      tags: JSON.stringify([format, "public"]),
      published: true,
    })
    .returning();
  if (!item) return NextResponse.json({ error: "The file could not be saved." }, { status: 500 });
  return NextResponse.json({ item }, { status: 201 });
}
