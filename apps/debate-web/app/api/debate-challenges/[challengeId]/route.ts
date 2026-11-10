import { NextRequest, NextResponse } from "next/server";
import { getDBFromContext } from "@/lib/database/context";
import { getUserId } from "@/lib/auth/session";
import { withRouteErrors } from "@/lib/api/route-errors";
import { getViewer } from "@/lib/practice-partners/queries";
import { challengeTextGenerator } from "@/lib/debate-challenges/ai";
import { ensureDebateChallengeTables } from "@/lib/debate-challenges/ensure-tables";
import {
  advanceRow,
  claimReward,
  getChallengeRow,
  listViewerChallenges,
  rowToState,
  settleRow,
  viewsFor,
  writeMove,
} from "@/lib/debate-challenges/store";
import { applyChallengeMove, sideOf } from "@debate-ai/practice-rounds/src/debate-challenges/rules";
import { parseChallengeUpdate } from "@debate-ai/practice-rounds/src/debate-challenges/validation";
import { parseChallengeId } from "@debate-ai/practice-rounds/src/practice-partners/validation";
import { SPEECH_ORDER } from "@debate-ai/practice-rounds/src/debate-challenges/types";

/**
 * One Online Challenge, moved along by its debaters.
 *
 * PATCH { action, text? } — `speak` (whoever's turn it is; the opponent's
 *   first speech accepts the challenge), `decline` (the opponent, before
 *   answering), `cancel` (the challenger, before an answer), `concede` (either
 *   debater, mid-round), or `claim` (collect a finished round's XP, once per
 *   debater). The rules are `applyChallengeMove` in
 *   `@debate-ai/practice-rounds/src/debate-challenges/rules.ts`, which the board
 *   also reads to draw its buttons. Against the AI, the AI's answer (and the
 *   judge, after the last speech) runs before this replies.
 *
 * Returns `{ challenge }` as it now stands. A round that changed under the
 * request (another tab, a board read running the AI) answers 409.
 */

export const PATCH = withRouteErrors(
  "PATCH /api/debate-challenges/[challengeId]",
  async (req: NextRequest, context: { params: Promise<{ challengeId: string }> }) => {
    const userId = await getUserId();
    if (!userId) return NextResponse.json({ error: "Sign in to answer challenges." }, { status: 401 });

    const { challengeId } = await context.params;
    const id = parseChallengeId(challengeId);
    if (!id.ok) return NextResponse.json({ error: "That is not a challenge." }, { status: 400 });

    let payload: unknown;
    try {
      payload = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
    }
    const update = parseChallengeUpdate(payload);
    if (!update.ok) return NextResponse.json({ error: update.error }, { status: 400 });

    const db = await getDBFromContext();
    await ensureDebateChallengeTables(db);
    const [found, viewer] = await Promise.all([getChallengeRow(db, id.value), getViewer(db, userId)]);
    if (!found || !viewer || sideOf(rowToState(found), userId) === null) {
      // Not a 403: a challenge you are not in is not one you can confirm exists.
      return NextResponse.json({ error: "That challenge no longer exists." }, { status: 404 });
    }

    const nowSeconds = Math.floor(Date.now() / 1000);
    let row = await settleRow(db, found, nowSeconds);

    if (update.value.action === "claim") {
      // Rewards depend on the whole record (the boost is the streak), so the
      // claim is checked against the viewer's summary.
      const all = await listViewerChallenges(db, userId);
      const { summary } = await viewsFor(db, all, userId, nowSeconds);
      const reward = summary.rewards.get(row.id);
      if (!reward || reward.xp <= 0 || reward.claimed || !(await claimReward(db, row, userId))) {
        return NextResponse.json({ error: "Nothing to collect on this round." }, { status: 409 });
      }
      row = (await getChallengeRow(db, row.id)) ?? row;
      const { views } = await viewsFor(db, all.map((r) => (r.id === row.id ? row : r)), userId, nowSeconds);
      return NextResponse.json({ challenge: views.find((view) => view.id === row.id) });
    }

    const state = rowToState(row);
    const result = applyChallengeMove(state, userId, update.value.action, nowSeconds, update.value.text);
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });

    const spoken = SPEECH_ORDER[state.speeches.length]?.label.toLowerCase() ?? "speech";
    const notice = {
      speak:
        state.status === "pending"
          ? { title: `${viewer.name} accepted your challenge`, body: `They gave the ${spoken} — your turn on “${row.topic}”.` }
          : result.next.status === "judging"
            ? { title: `${viewer.name} gave the last speech`, body: `The AI judge is deciding “${row.topic}”.` }
            : { title: `${viewer.name} gave the ${spoken}`, body: `Your turn on “${row.topic}”.` },
      decline: { title: `${viewer.name} declined your challenge`, body: row.topic },
      cancel: { title: `${viewer.name} withdrew their challenge`, body: row.topic },
      concede: { title: `${viewer.name} conceded — you win`, body: row.topic },
    }[update.value.action];

    const written = await writeMove(db, row, result.next, result.notify, notice);
    if (!written) return NextResponse.json({ error: "This round just changed — reload and try again." }, { status: 409 });
    row = await advanceRow(db, written, challengeTextGenerator(req), nowSeconds);

    const all = await listViewerChallenges(db, userId);
    const { views } = await viewsFor(db, all, userId, nowSeconds);
    return NextResponse.json({ challenge: views.find((view) => view.id === row.id) ?? views[0] });
  },
);
