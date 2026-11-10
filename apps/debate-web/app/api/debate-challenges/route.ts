import { NextRequest, NextResponse } from "next/server";
import { getDBFromContext } from "@/lib/database/context";
import { getUserId } from "@/lib/auth/session";
import { withRouteErrors } from "@/lib/api/route-errors";
import { getViewer, loadBlockedIds } from "@/lib/practice-partners/queries";
import { challengeTextGenerator } from "@/lib/debate-challenges/ai";
import { ensureDebateChallengeTables } from "@/lib/debate-challenges/ensure-tables";
import {
  MAX_AI_CHALLENGES_PER_DAY,
  advanceRow,
  countAiChallengesSince,
  countPendingSent,
  hasPendingWith,
  insertChallengeRow,
  loadBoard,
  notifyChallengePlayers,
  viewsFor,
} from "@/lib/debate-challenges/store";
import { createChallengeRound } from "@debate-ai/practice-rounds/src/debate-challenges/rules";
import { parseNewDebateChallenge } from "@debate-ai/practice-rounds/src/debate-challenges/validation";
import {
  CHALLENGE_FORMATS,
  MAX_PENDING_SENT,
  RESPONSE_WINDOW_DAYS,
  challengeOptionLabel,
} from "@debate-ai/practice-rounds/src/debate-challenges/types";
import { user } from "@/lib/database/schema";
import { eq } from "drizzle-orm";

/**
 * Online Challenges — asynchronous written debates against another player or
 * the AI (`@debate-ai/practice-rounds/src/debate-challenges`).
 *
 * GET — the board: every challenge the viewer is in, their record, the boost
 *   their next win gets, and their trophies. Overdue rounds are expired or
 *   forfeited first, and a couple of waiting AI turns or judgings are run
 *   (`lib/debate-challenges/store.ts`). Account-only, 401 without a session.
 *
 * POST { opponentId | "ai", aiLevel?, format, topic, side, speech?, note? } —
 *   sends a challenge. An Aff challenger's opening speech goes with it. Against
 *   the AI, the AI's first speech is written before this answers. Returns
 *   `{ challenge }` (201).
 *
 * Refused when: the opponent is the challenger, doesn't exist, is a guest, or
 * has a block with the challenger either way (reported as "not found", so a
 * block isn't revealed); the challenger already has a challenge waiting on
 * them; the challenger has {@link MAX_PENDING_SENT} challenges unanswered; or
 * the challenger has started {@link MAX_AI_CHALLENGES_PER_DAY} AI challenges
 * today.
 */

export const GET = withRouteErrors("GET /api/debate-challenges", async (req: NextRequest) => {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "Sign in to see your challenges." }, { status: 401 });

  const db = await getDBFromContext();
  await ensureDebateChallengeTables(db);
  const viewer = await getViewer(db, userId);
  if (!viewer) return NextResponse.json({ error: "Sign in to see your challenges." }, { status: 401 });

  const board = await loadBoard(
    db,
    { id: viewer.id, name: viewer.name, imageUrl: viewer.imageUrl },
    challengeTextGenerator(req),
    Math.floor(Date.now() / 1000),
  );
  return NextResponse.json(board, { headers: { "Cache-Control": "no-store" } });
});

export const POST = withRouteErrors("POST /api/debate-challenges", async (req: NextRequest) => {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "Sign in to send a challenge." }, { status: 401 });

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  const parsed = parseNewDebateChallenge(payload);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const input = parsed.value;
  if (input.opponentId === userId) return NextResponse.json({ error: "You can't challenge yourself." }, { status: 400 });

  const db = await getDBFromContext();
  await ensureDebateChallengeTables(db);
  const viewer = await getViewer(db, userId);
  if (!viewer) return NextResponse.json({ error: "Sign in to send a challenge." }, { status: 401 });

  if (input.vsAi) {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    if ((await countAiChallengesSince(db, userId, since)) >= MAX_AI_CHALLENGES_PER_DAY) {
      return NextResponse.json(
        { error: `You can start ${MAX_AI_CHALLENGES_PER_DAY} AI challenges a day — finish one or come back tomorrow.` },
        { status: 429 },
      );
    }
  } else {
    if (viewer.isAnonymous) {
      return NextResponse.json({ error: "Create an account to challenge other players." }, { status: 403 });
    }
    const [opponent] = await db
      .select({ id: user.id, isAnonymous: user.isAnonymous })
      .from(user)
      .where(eq(user.id, input.opponentId))
      .limit(1);
    const blocked = await loadBlockedIds(db, userId);
    if (!opponent || opponent.isAnonymous || blocked.has(input.opponentId)) {
      return NextResponse.json({ error: "That player can't be challenged." }, { status: 404 });
    }
    if (await hasPendingWith(db, userId, input.opponentId)) {
      return NextResponse.json({ error: "You already have a challenge waiting on this player." }, { status: 409 });
    }
    if ((await countPendingSent(db, userId)) >= MAX_PENDING_SENT) {
      return NextResponse.json(
        { error: `You have ${MAX_PENDING_SENT} challenges waiting on answers — withdraw one or wait for replies.` },
        { status: 429 },
      );
    }
  }

  const nowSeconds = Math.floor(Date.now() / 1000);
  const round = createChallengeRound(
    { challengerId: userId, opponentId: input.opponentId, challengerSide: input.side, openingSpeech: input.speech },
    nowSeconds,
  );
  if (!round.ok) return NextResponse.json({ error: round.error }, { status: 400 });

  let row = await insertChallengeRow(db, {
    id: crypto.randomUUID(),
    challengerId: userId,
    opponentId: input.opponentId,
    aiLevel: input.aiLevel,
    format: input.format,
    topic: input.topic,
    note: input.note,
    state: round.state,
  });

  if (input.vsAi) {
    row = await advanceRow(db, row, challengeTextGenerator(req), nowSeconds);
  } else {
    await notifyChallengePlayers(
      db,
      [input.opponentId],
      `${viewer.name} challenged you to a debate`,
      `${challengeOptionLabel(CHALLENGE_FORMATS, input.format)} — ${input.topic}. You have ${RESPONSE_WINDOW_DAYS} days to answer.`,
    );
  }

  const { views } = await viewsFor(db, [row], userId, nowSeconds);
  return NextResponse.json({ challenge: views[0] }, { status: 201 });
});
