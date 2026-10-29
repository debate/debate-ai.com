/**
 * @fileoverview Anyone signed in proposes an edit to the public Topic
 * Starters catalogue: move, rename, delete, new folder, submit a file, or an
 * AI reorganization.
 *
 * A moderator's or admin's edit is applied at once (`{ status: "applied" }`);
 * everyone else's waits in the admin panel's Topic starters queue
 * (`202 { status: "pending", id }`) until a moderator approves it. See
 * `lib/topic-starters/changes.ts`.
 *
 * @module app/api/topic-starters/changes/route
 */
import { NextRequest, NextResponse } from "next/server";
import { parseTopicStarterChange } from "@debate-ai/reason-docs/lib/topic-starters/changes";
import { getAdminEmails, getStaffAccess } from "@/lib/auth/admin";
import { getSession } from "@/lib/auth/session";
import { getDBFromContext } from "@/lib/database/context";
import {
  TopicStarterChangeError,
  applyTopicStarterChange,
  queueTopicStarterChange,
} from "@/lib/topic-starters/changes";

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Sign in to suggest changes to Topic Starters." }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Expected a JSON body." }, { status: 400 });
  }
  const parsed = parseTopicStarterChange(body);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const db = await getDBFromContext();
  const { canEditContent, email } = await getStaffAccess();
  try {
    if (canEditContent) {
      await applyTopicStarterChange(db, parsed.change);
      return NextResponse.json({ status: "applied" });
    }
    const id = await queueTopicStarterChange(
      db,
      parsed.change,
      { userId: session.user.id, email: email ?? session.user.email ?? null },
      getAdminEmails(),
    );
    return NextResponse.json({ status: "pending", id }, { status: 202 });
  } catch (error) {
    if (error instanceof TopicStarterChangeError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Topic Starters change failed:", error);
    return NextResponse.json({ error: "The change could not be saved." }, { status: 500 });
  }
}
