/**
 * @fileoverview A moderator approves or rejects one proposed Topic Starters
 * edit. Approving applies it to the live catalogue.
 *
 * @module app/api/admin/topic-starters/changes/[id]/route
 */
import { NextRequest, NextResponse } from "next/server";
import { getStaffAccess } from "@/lib/auth/admin";
import { getDBFromContext } from "@/lib/database/context";
import { TopicStarterChangeError, reviewTopicStarterChange } from "@/lib/topic-starters/changes";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { canEditContent, email } = await getStaffAccess();
  if (!canEditContent) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const changeId = Number(id);
  if (!Number.isInteger(changeId) || changeId <= 0) {
    return NextResponse.json({ error: "That change does not exist." }, { status: 404 });
  }
  let body: { decision?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Expected a JSON body." }, { status: 400 });
  }
  if (body.decision !== "approve" && body.decision !== "reject") {
    return NextResponse.json({ error: 'decision must be "approve" or "reject".' }, { status: 400 });
  }

  const db = await getDBFromContext();
  try {
    const change = await reviewTopicStarterChange(db, changeId, body.decision, email);
    return NextResponse.json({ change });
  } catch (error) {
    if (error instanceof TopicStarterChangeError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Topic Starters review failed:", error);
    return NextResponse.json({ error: "The change could not be applied." }, { status: 500 });
  }
}
