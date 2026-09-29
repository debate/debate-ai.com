import { NextRequest, NextResponse } from "next/server";
import { getDBFromContext } from "@/lib/database/context";
import { getUserId } from "@/lib/auth/session";
import { withRouteErrors } from "@/lib/api/route-errors";
import {
  getChallenge,
  getChallengeRow,
  getProfile,
  getViewer,
  loadBlockedIds,
  notifyPracticePartners,
  rowState,
  updateChallengeState,
} from "@/lib/practice-partners/queries";
import { parseChallengeId } from "debate-webview/lib/practice-partners/validation";
import {
  applyChallengeAction,
  challengeNotificationTitle,
  isChallengeAction,
} from "debate-webview/lib/practice-partners/challenge-actions";
import { PRACTICE_FORMATS, optionLabel } from "debate-webview/lib/practice-partners/types";

/**
 * One practice challenge, moved along by the people in it.
 *
 * PATCH { action } — `accept` | `decline` (the opponent), `cancel` (either
 *   debater), `confirm-judge` | `decline-judge` | `withdraw-judge` (the judge),
 *   or `volunteer-judge` (any judge volunteer, on an accepted round with an
 *   empty seat). Who may do what is `applyChallengeAction` in
 *   `debate-webview/lib/practice-partners/challenge-actions.ts` — the same rules
 *   the board uses to decide which buttons to draw. Returns the challenge as it
 *   now stands, and notifies everyone else in it.
 *
 * The write is guarded on the state the action was computed from, so two
 * judges picking up the same round at once cannot both get it: the second
 * write matches no row and gets a 409.
 */

export const PATCH = withRouteErrors(
  "PATCH /api/practice-partners/challenges/[challengeId]",
  async (req: NextRequest, context: { params: Promise<{ challengeId: string }> }) => {
    const userId = await getUserId();
    if (!userId) {
      return NextResponse.json({ error: "Sign in to answer challenges." }, { status: 401 });
    }

    const { challengeId } = await context.params;
    const id = parseChallengeId(challengeId);
    if (!id.ok) {
      return NextResponse.json({ error: id.error }, { status: 400 });
    }

    let payload: unknown;
    try {
      payload = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
    }
    const action = (payload as { action?: unknown } | null)?.action;
    if (!isChallengeAction(action)) {
      return NextResponse.json({ error: "Unknown action." }, { status: 400 });
    }

    const db = await getDBFromContext();
    const row = await getChallengeRow(db, id.value);
    const viewer = await getViewer(db, userId);
    if (!row || !viewer) {
      return NextResponse.json({ error: "That challenge no longer exists." }, { status: 404 });
    }

    const from = rowState(row);
    const inRound = [from.challengerId, from.opponentId, from.judgeId].includes(userId);

    // Someone outside the round may only ever pick it up as judge — and a
    // judge with a block against either debater may not, the same rule the
    // board applies when it lists the round.
    let isJudgeVolunteer = false;
    if (action === "volunteer-judge") {
      const [profile, blocked] = await Promise.all([getProfile(db, userId), loadBlockedIds(db, userId)]);
      if (blocked.has(from.challengerId) || blocked.has(from.opponentId)) {
        return NextResponse.json({ error: "That challenge no longer exists." }, { status: 404 });
      }
      isJudgeVolunteer = Boolean(profile?.asJudge) && !viewer.isAnonymous;
    } else if (!inRound) {
      // Not a 403: a challenge you are not in is not one you can confirm exists.
      return NextResponse.json({ error: "That challenge no longer exists." }, { status: 404 });
    }

    const result = applyChallengeAction(from, userId, action, isJudgeVolunteer);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    const landed = await updateChallengeState(db, id.value, from, result.next);
    if (!landed) {
      return NextResponse.json(
        { error: "Someone else just changed this challenge — refresh to see where it stands." },
        { status: 409 },
      );
    }

    await notifyPracticePartners(db, result.notify, {
      title: challengeNotificationTitle(action, viewer.name),
      body: `${optionLabel(PRACTICE_FORMATS, row.format)} — ${row.topic}`,
    });

    const updated = await getChallenge(db, id.value);
    if (!updated) {
      return NextResponse.json({ error: "That challenge no longer exists." }, { status: 404 });
    }
    return NextResponse.json(updated);
  },
);
