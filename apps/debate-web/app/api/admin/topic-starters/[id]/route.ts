/**
 * @fileoverview Moderator/admin-only: delete one Topic Starter item (a file,
 * or a folder with everything in it), rename it, or re-file it under another
 * folder. Copies go through `./copy`.
 *
 * All apply the same change records the sidebar's edits do
 * (`lib/topic-starters/changes.ts`), so a direct call here and an approved
 * reader proposal can never disagree about what a delete or move means.
 * Readers who aren't staff propose edits through `/api/topic-starters/changes`
 * instead, where they wait for a moderator.
 *
 * @module app/api/admin/topic-starters/[id]/route
 */
import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { parseTopicStarterChange, type TopicStarterChange } from "@debate-ai/reason-docs/lib/topic-starters/changes";
import { getStaffAccess } from "@/lib/auth/admin";
import { getDBFromContext } from "@/lib/database/context";
import { topicStarterItems } from "@/lib/database/schema";
import { TopicStarterChangeError, applyTopicStarterChange } from "@/lib/topic-starters/changes";

async function staffItemId(params: Promise<{ id: string }>): Promise<number | NextResponse> {
  const { id } = await params;
  const { canEditContent } = await getStaffAccess();
  if (!canEditContent) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const docId = Number(id);
  if (!Number.isInteger(docId) || docId <= 0) {
    return NextResponse.json({ error: "That Topic Starter item does not exist." }, { status: 404 });
  }
  return docId;
}

async function apply(change: TopicStarterChange): Promise<NextResponse | null> {
  try {
    await applyTopicStarterChange(await getDBFromContext(), change);
    return null;
  } catch (error) {
    if (error instanceof TopicStarterChangeError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const itemId = await staffItemId(params);
  if (itemId instanceof NextResponse) return itemId;
  const failed = await apply({ kind: "delete", itemId });
  return failed ?? NextResponse.json({ success: true });
}

/**
 * Renames the item when the body carries `title`, and re-files it under
 * `parentId` (a catalogue folder, or the top level when null) when the body
 * names `parentId`.
 */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const itemId = await staffItemId(params);
  if (itemId instanceof NextResponse) return itemId;

  let body: { parentId?: number | null; title?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Expected a JSON body." }, { status: 400 });
  }
  if (body.title !== undefined) {
    const parsed = parseTopicStarterChange({ kind: "rename", itemId, title: body.title });
    if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
    const failed = await apply(parsed.change);
    if (failed) return failed;
  }
  if ("parentId" in body) {
    const parentId = typeof body.parentId === "number" ? body.parentId : null;
    const failed = await apply({ kind: "move", itemId, parentId });
    if (failed) return failed;
  }

  const [updated] = await (await getDBFromContext())
    .select()
    .from(topicStarterItems)
    .where(eq(topicStarterItems.id, itemId))
    .limit(1);
  return NextResponse.json(updated ?? { id: itemId });
}
