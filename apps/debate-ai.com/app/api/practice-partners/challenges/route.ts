import { NextRequest, NextResponse } from "next/server";
import { getDBFromContext } from "@/lib/database/context";
import { getUserId } from "@/lib/auth/session";
import { withRouteErrors } from "@/lib/api/route-errors";
import {
  countPendingOutgoing,
  getProfile,
  getViewer,
  hasPendingChallenge,
  insertChallenge,
  loadBlockedIds,
  notifyPracticePartners,
} from "@/lib/practice-partners/queries";
import { parseNewChallenge } from "@/lib/practice-partners/validation";
import {
  MAX_PENDING_OUTGOING,
  PRACTICE_FORMATS,
  optionLabel,
} from "debate-webview/lib/practice-partners/types";

/**
 * Sends a practice challenge.
 *
 * POST { opponentId, judgeId?, format, topic, message?, proposedAt? } — challenges
 *   a debater who is open to challenges, optionally inviting a judge volunteer,
 *   and notifies both. Returns the challenge (201) as the board shows it.
 *
 * Refused when: the opponent (or judge) has not volunteered for that role, is
 * the challenger, or has a block with the challenger in either direction; the
 * challenger already has a challenge waiting on this opponent; or the
 * challenger has {@link MAX_PENDING_OUTGOING} challenges waiting on answers.
 * A blocked pairing is reported as "not open to challenges" — the same answer
 * as a volunteer who switched off — so the reply does not reveal the block.
 */

export const POST = withRouteErrors("POST /api/practice-partners/challenges", async (req: NextRequest) => {
  const userId = await getUserId();
  if (!userId) {
    return NextResponse.json({ error: "Sign in to challenge someone." }, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = parseNewChallenge(payload, Math.floor(Date.now() / 1000));
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }
  const challenge = parsed.value;

  if (challenge.opponentId === userId) {
    return NextResponse.json({ error: "You can't challenge yourself." }, { status: 400 });
  }
  if (challenge.judgeId === userId) {
    return NextResponse.json({ error: "You can't judge a round you're debating in." }, { status: 400 });
  }

  const db = await getDBFromContext();
  const viewer = await getViewer(db, userId);
  if (!viewer) {
    return NextResponse.json({ error: "Sign in to challenge someone." }, { status: 401 });
  }
  if (viewer.isAnonymous) {
    return NextResponse.json({ error: "Create an account to challenge someone." }, { status: 403 });
  }

  const [blocked, opponentProfile, judgeProfile] = await Promise.all([
    loadBlockedIds(db, userId),
    getProfile(db, challenge.opponentId),
    challenge.judgeId ? getProfile(db, challenge.judgeId) : Promise.resolve(null),
  ]);

  if (!opponentProfile?.asCompetitor || blocked.has(challenge.opponentId)) {
    return NextResponse.json({ error: "That debater isn't open to challenges right now." }, { status: 409 });
  }
  if (challenge.judgeId && (!judgeProfile?.asJudge || blocked.has(challenge.judgeId))) {
    return NextResponse.json({ error: "That judge isn't volunteering right now." }, { status: 409 });
  }

  if (await hasPendingChallenge(db, userId, challenge.opponentId)) {
    return NextResponse.json(
      { error: "You already have a challenge waiting on this debater." },
      { status: 409 },
    );
  }
  if ((await countPendingOutgoing(db, userId)) >= MAX_PENDING_OUTGOING) {
    return NextResponse.json(
      { error: `You have ${MAX_PENDING_OUTGOING} challenges waiting on answers — cancel one or wait for replies.` },
      { status: 429 },
    );
  }

  const created = await insertChallenge(db, { id: crypto.randomUUID(), challengerId: userId, challenge });

  const roundLine = `${optionLabel(PRACTICE_FORMATS, challenge.format)} — ${challenge.topic}`;
  await notifyPracticePartners(db, [challenge.opponentId], {
    title: `${viewer.name} challenged you to a practice round`,
    body: roundLine,
  });
  if (challenge.judgeId) {
    await notifyPracticePartners(db, [challenge.judgeId], {
      title: `${viewer.name} invited you to judge a practice round`,
      body: roundLine,
    });
  }

  return NextResponse.json(created, { status: 201 });
});
