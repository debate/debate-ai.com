/**
 * @fileoverview Admin-only: delete one Topic Starter item — a file, or a
 * folder with everything in it.
 *
 * The catalogue is read-only for everyone but admins, and until now there
 * was no way to remove a starter once it was in: the importer only adds.
 * This lets an admin drop a file or an entire folder (cascade, since SQLite
 * has no FK-enforced cascade delete here), leaving the rest of the
 * catalogue alone.
 *
 * @module app/api/admin/topic-starters/[id]/route
 */
import { and, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { getAdminAccess } from "@/lib/auth/admin";
import { getDBFromContext } from "@/lib/database/context";
import { topicStarterItems } from "@/lib/database/schema";

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { isAdmin } = await getAdminAccess();
  if (!isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const docId = Number(id);
  if (!Number.isInteger(docId) || docId <= 0) {
    return NextResponse.json({ error: "That Topic Starter item does not exist." }, { status: 404 });
  }

  const db = await getDBFromContext();

  // Folders cascade: this app has no FK-enforced cascade delete, so gather
  // every descendant client-side before deleting.
  const idsToDelete: number[] = [];
  const collect = async (targetId: number): Promise<void> => {
    idsToDelete.push(targetId);
    const children = await db.select().from(topicStarterItems).where(eq(topicStarterItems.parentId, targetId));
    for (const row of children) await collect(row.id);
  };
  await collect(docId);

  for (const idToDelete of idsToDelete) {
    await db.delete(topicStarterItems).where(eq(topicStarterItems.id, idToDelete));
  }

  return NextResponse.json({ success: true, deleted: idsToDelete.length });
}

/**
 * Re-files one Topic Starter item under another catalogue folder, or the
 * top level. Admin-only: the catalogue is read-only for everyone else.
 *
 * A folder moves with its whole subtree — the rows keep their `parentId`
 * relative to each other, so only the moved root's parent changes and the
 * children stay correct by themselves.
 */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { isAdmin } = await getAdminAccess();
  if (!isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const docId = Number(id);
  if (!Number.isInteger(docId) || docId <= 0) {
    return NextResponse.json({ error: "That Topic Starter item does not exist." }, { status: 404 });
  }

  let body: { parentId?: number | null; title?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Expected a JSON body." }, { status: 400 });
  }

  const db = await getDBFromContext();
  const [target] = await db.select().from(topicStarterItems).where(eq(topicStarterItems.id, docId)).limit(1);
  if (!target) return NextResponse.json({ error: "That Topic Starter item does not exist." }, { status: 404 });

  const updates: { parentId?: number | null; title?: string; updatedAt?: Date } = {};

  let parentId = (target.parentId ?? null) as number | null;
  if (body.parentId !== undefined) {
    parentId = typeof body.parentId === "number" ? body.parentId : null;
    if (parentId != null) {
      // Filed only under a real catalogue folder, so the row can't be orphaned
      // under a file or a deleted folder and vanish from the tree.
      const [parent] = await db
        .select({ id: topicStarterItems.id })
        .from(topicStarterItems)
        .where(and(eq(topicStarterItems.id, parentId), eq(topicStarterItems.isFolder, true)))
        .limit(1);
      if (!parent) return NextResponse.json({ error: "That Topic Starters folder no longer exists." }, { status: 400 });
      // A folder can't be moved into its own subtree.
      if (target.isFolder) {
        const descendants = new Set<number>([target.id]);
        const queue: number[] = [target.id];
        while (queue.length > 0) {
          const current = queue.shift()!;
          const children = await db.select().from(topicStarterItems).where(eq(topicStarterItems.parentId, current));
          for (const child of children) {
            if (descendants.has(child.id)) continue;
            descendants.add(child.id);
            queue.push(child.id);
          }
        }
        if (descendants.has(parentId)) {
          return NextResponse.json({ error: "A folder cannot be moved into its own subtree." }, { status: 400 });
        }
      }
    }
    updates.parentId = parentId;
  }

  if (body.title !== undefined) {
    const title = body.title?.trim();
    if (!title) return NextResponse.json({ error: "A title is required." }, { status: 400 });
    updates.title = title;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json(target);
  }

  updates.updatedAt = new Date();

  const [updated] = await db
    .update(topicStarterItems)
    .set(updates)
    .where(eq(topicStarterItems.id, docId))
    .returning();
  if (!updated) return NextResponse.json({ error: "The item could not be updated." }, { status: 500 });
  return NextResponse.json(updated);
}