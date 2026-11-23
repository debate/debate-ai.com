import { NextRequest, NextResponse } from "next/server";
import { getDBFromContext } from "@/lib/database/context";
import { getUserId } from "@/lib/auth/session";
import { withRouteErrors } from "@/lib/api/route-errors";
import { getViewer, loadBlockedIds } from "@/lib/practice-partners/queries";
import { ensureTopicSignupTables } from "@/lib/topic-signups/ensure-tables";
import { TopicActionError, applyTopicAction, listActiveTopics, loadTopicBoard } from "@/lib/topic-signups/store";
import { parseTopicAction, parseTopicTarget } from "@debate-ai/practice-rounds/src/topic-signups/validation";

/**
 * Topic Sign-ups — the board every listed resolution links to
 * (`/practice/debates?section=topics&topic=…`,
 * `@debate-ai/practice-rounds/src/topic-signups`).
 *
 * GET — no `topic`: the most recently active boards with their counts
 *   (public). With `?topic=…[&format=…&source=…]`: that topic's board — the
 *   viewer's own sign-up, everyone else signed up, its research squads with
 *   their members, and the research notes added to it. Account-only, 401
 *   without a session.
 *
 * POST { topic, format?, source?, action, … } — `signup` (role, side, note;
 *   again to update), `withdraw`, `create-squad` (name, about), `join-squad`
 *   / `leave-squad` (squadId; the last member out closes it), `add-note`
 *   (kind, title, url, body) and `delete-note` (noteId, own notes only).
 *   Returns the refreshed board. Guest accounts are refused (403).
 */

const SIGN_IN = "Sign in to sign up for this topic.";

export const GET = withRouteErrors("GET /api/topic-signups", async (req: NextRequest) => {
  const url = new URL(req.url);
  const db = await getDBFromContext();
  await ensureTopicSignupTables(db);

  if (!url.searchParams.get("topic")) {
    return NextResponse.json({ topics: await listActiveTopics(db) }, { headers: { "Cache-Control": "no-store" } });
  }

  const target = parseTopicTarget({
    topic: url.searchParams.get("topic"),
    format: url.searchParams.get("format"),
    source: url.searchParams.get("source"),
  });
  if (!target.ok) return NextResponse.json({ error: target.error }, { status: 400 });

  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: SIGN_IN }, { status: 401 });
  const viewer = await getViewer(db, userId);
  if (!viewer) return NextResponse.json({ error: SIGN_IN }, { status: 401 });

  const board = await loadTopicBoard(db, target.value, viewer, await loadBlockedIds(db, userId));
  return NextResponse.json(board, { headers: { "Cache-Control": "no-store" } });
});

export const POST = withRouteErrors("POST /api/topic-signups", async (req: NextRequest) => {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: SIGN_IN }, { status: 401 });

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  const parsed = parseTopicAction(payload);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const db = await getDBFromContext();
  await ensureTopicSignupTables(db);
  const viewer = await getViewer(db, userId);
  if (!viewer) return NextResponse.json({ error: SIGN_IN }, { status: 401 });
  if (viewer.isAnonymous) {
    return NextResponse.json({ error: "Create an account to sign up, join squads or add research." }, { status: 403 });
  }

  try {
    await applyTopicAction(db, parsed.value, viewer);
  } catch (error) {
    if (error instanceof TopicActionError) return NextResponse.json({ error: error.message }, { status: error.status });
    throw error;
  }

  const board = await loadTopicBoard(db, parsed.value.topic, viewer, await loadBlockedIds(db, userId));
  return NextResponse.json(board);
});
