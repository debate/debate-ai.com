/**
 * @fileoverview Moderator/admin-only: paste a copy of one Topic Starter item
 * (a file, or a folder with everything in it) under another folder — the
 * admin panel tree's Copy / Paste.
 *
 * @module app/api/admin/topic-starters/[id]/copy/route
 */
import { NextRequest, NextResponse } from "next/server";
import { getStaffAccess } from "@/lib/auth/admin";
import { getDBFromContext } from "@/lib/database/context";
import { TopicStarterChangeError, copyTopicStarterItem } from "@/lib/topic-starters/changes";

/** Copies the item under `parentId` (a catalogue folder), or the top level when null. */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { canEditContent } = await getStaffAccess();
  if (!canEditContent) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const itemId = Number((await params).id);
  if (!Number.isInteger(itemId) || itemId <= 0) {
    return NextResponse.json({ error: "That Topic Starter item does not exist." }, { status: 404 });
  }

  let body: { parentId?: number | null };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Expected a JSON body." }, { status: 400 });
  }
  const parentId = typeof body.parentId === "number" ? body.parentId : null;
  try {
    const id = await copyTopicStarterItem(await getDBFromContext(), itemId, parentId);
    return NextResponse.json({ id }, { status: 201 });
  } catch (error) {
    if (error instanceof TopicStarterChangeError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }
}
