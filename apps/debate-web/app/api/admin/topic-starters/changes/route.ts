/**
 * @fileoverview Moderators' and admins' queue of proposed Topic Starters
 * edits. `?status=pending` (the default), `approved`, `rejected` or `all`.
 *
 * @module app/api/admin/topic-starters/changes/route
 */
import { NextRequest, NextResponse } from "next/server";
import { getStaffAccess } from "@/lib/auth/admin";
import { getDBFromContext } from "@/lib/database/context";
import { listTopicStarterChanges } from "@/lib/topic-starters/changes";

const STATUSES = ["pending", "approved", "rejected", "all"] as const;

export async function GET(request: NextRequest) {
  const { canEditContent } = await getStaffAccess();
  if (!canEditContent) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const raw = request.nextUrl.searchParams.get("status") ?? "pending";
  const status = (STATUSES as readonly string[]).includes(raw) ? (raw as (typeof STATUSES)[number]) : "pending";
  const db = await getDBFromContext();
  return NextResponse.json({ changes: await listTopicStarterChanges(db, status) });
}
