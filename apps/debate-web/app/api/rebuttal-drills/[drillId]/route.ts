import { NextRequest, NextResponse } from "next/server";
import { getDBFromContext } from "@/lib/database/context";
import { getUserId } from "@/lib/auth/session";
import { withRouteErrors } from "@/lib/api/route-errors";
import { getViewer } from "@/lib/practice-partners/queries";
import { challengeTextGenerator } from "@/lib/debate-challenges/ai";
import { ensureRebuttalDrillTables } from "@/lib/rebuttal-drills/ensure-tables";
import {
  advanceDrill,
  coachDraft,
  drillViewsFor,
  getDrillRow,
  notifyDrillPlayers,
  rowToState,
  writeDrillState,
} from "@/lib/rebuttal-drills/store";
import { applyDrillMove, drillSideOf } from "@debate-ai/practice-rounds/src/rebuttal-playlists/rules";
import { parseRebuttalDrillUpdate } from "@debate-ai/practice-rounds/src/rebuttal-playlists/validation";
import { parseChallengeId } from "@debate-ai/practice-rounds/src/practice-partners/validation";

/**
 * One rebuttal drill, moved along by its debaters.
 *
 * PATCH { action, text? } — `submit` (turn in your rebuttal, once; the second
 *   one in sends the drill to the AI judge, which runs before this replies),
 *   `coach` (AI coach help on a draft in `text`, a few times per side),
 *   `use_ai` (the starter stops waiting and takes the AI as partner — its
 *   rebuttal is written before this replies) or `cancel` (the starter, while
 *   still waiting). The rules are `applyDrillMove` in
 *   `@debate-ai/practice-rounds/src/rebuttal-playlists/rules.ts`.
 *
 * Returns `{ drill }`, plus `{ coach: { feedback } }` for `coach`. A drill
 * that changed under the request answers 409; a coach call no model
 * answered answers 503 without spending the request.
 */

export const PATCH = withRouteErrors(
  "PATCH /api/rebuttal-drills/[drillId]",
  async (req: NextRequest, context: { params: Promise<{ drillId: string }> }) => {
    const userId = await getUserId();
    if (!userId) return NextResponse.json({ error: "Sign in to work on your drills." }, { status: 401 });

    const { drillId } = await context.params;
    const id = parseChallengeId(drillId);
    if (!id.ok) return NextResponse.json({ error: "That is not a drill." }, { status: 400 });

    let payload: unknown;
    try {
      payload = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
    }
    const update = parseRebuttalDrillUpdate(payload);
    if (!update.ok) return NextResponse.json({ error: update.error }, { status: 400 });

    const db = await getDBFromContext();
    await ensureRebuttalDrillTables(db);
    const [found, viewer] = await Promise.all([getDrillRow(db, id.value), getViewer(db, userId)]);
    const side = found ? drillSideOf(rowToState(found), userId) : null;
    if (!found || !viewer || side === null) {
      return NextResponse.json({ error: "That drill no longer exists." }, { status: 404 });
    }

    const nowSeconds = Math.floor(Date.now() / 1000);
    const state = rowToState(found);
    const { action, text } = update.value;
    const result = applyDrillMove(state, userId, action, nowSeconds, text);
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
    const generate = challengeTextGenerator(req);

    if (action === "coach") {
      const feedback = await coachDraft(generate, found, side, text ?? "");
      if (!feedback) {
        return NextResponse.json({ error: "The AI coach is busy — try again in a minute." }, { status: 503 });
      }
      const written = await writeDrillState(db, found, result.next);
      const row = written ?? (await getDrillRow(db, found.id)) ?? found;
      const [view] = await drillViewsFor(db, [row], userId, nowSeconds);
      return NextResponse.json({ drill: view, coach: { feedback } });
    }

    const written = await writeDrillState(db, found, result.next);
    if (!written) return NextResponse.json({ error: "This drill just changed — reload and try again." }, { status: 409 });
    if (result.notify.length > 0) {
      await notifyDrillPlayers(db, result.notify, `${viewer.name} turned in their rebuttal`, `The AI judge is deciding “${found.topic}”.`);
    }
    const row = await advanceDrill(db, written, generate, nowSeconds);
    const [view] = await drillViewsFor(db, [row], userId, nowSeconds);
    return NextResponse.json({ drill: view });
  },
);
