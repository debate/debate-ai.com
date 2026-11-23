import { NextRequest, NextResponse } from "next/server";
import { getDBFromContext } from "@/lib/database/context";
import { getUserId } from "@/lib/auth/session";
import { withRouteErrors } from "@/lib/api/route-errors";
import { challengeTextGenerator } from "@/lib/debate-challenges/ai";
import { ensureRebuttalRedoTables } from "@/lib/rebuttal-redos/ensure-tables";
import { draftRoundRedos, getRedoViewer, loadRedoBoard, redoViews } from "@/lib/rebuttal-redos/store";
import { parseNewRedoRound } from "@debate-ai/practice-rounds/src/rebuttal-redos/validation";

/**
 * Rebuttal Redos — after a round, the judge gives each debater an AI-drafted
 * assignment to redo their last rebuttal, adds their own instructions, and
 * reviews the recorded redo later; finished redos earn fiat points
 * (`@debate-ai/practice-rounds/src/rebuttal-redos`).
 *
 * GET — the viewer's assignments (as a debater), the redos they wrote (as a
 *   judge), and their fiat points and badges. Redos written for the viewer's
 *   email are linked to their account first. Account-only, 401 without one.
 *
 * POST `NewRedoRound` — drafts one redo per debater on a round the viewer
 *   judged, with the model's assignment for each. Drafts are only visible to
 *   the judge until they assign them. Returns `{ redos, created }` (201), or
 *   the round's existing redos with `created: false` (200).
 */

export const GET = withRouteErrors("GET /api/rebuttal-redos", async () => {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "Sign in to see your rebuttal redos." }, { status: 401 });
  const db = await getDBFromContext();
  await ensureRebuttalRedoTables(db);
  const viewer = await getRedoViewer(db, userId);
  if (!viewer || viewer.isAnonymous) return NextResponse.json({ error: "Sign in to see your rebuttal redos." }, { status: 401 });
  return NextResponse.json(await loadRedoBoard(db, viewer), { headers: { "Cache-Control": "no-store" } });
});

export const POST = withRouteErrors("POST /api/rebuttal-redos", async (req: NextRequest) => {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "Sign in to assign rebuttal redos." }, { status: 401 });
  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  const parsed = parseNewRedoRound(payload);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const db = await getDBFromContext();
  await ensureRebuttalRedoTables(db);
  const viewer = await getRedoViewer(db, userId);
  if (!viewer || viewer.isAnonymous) {
    return NextResponse.json({ error: "Create an account to assign rebuttal redos." }, { status: 403 });
  }
  const result = await draftRoundRedos(db, viewer, parsed.value, challengeTextGenerator(req), Math.floor(Date.now() / 1000));
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: 400 });
  const redos = await redoViews(db, result.rows, viewer.id);
  return NextResponse.json({ redos, created: result.created }, { status: result.created ? 201 : 200 });
});
