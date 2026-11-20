import { NextRequest, NextResponse } from "next/server";
import { getDBFromContext } from "@/lib/database/context";
import { getUserId } from "@/lib/auth/session";
import { withRouteErrors } from "@/lib/api/route-errors";
import { getViewer, loadBlockedIds } from "@/lib/practice-partners/queries";
import { challengeTextGenerator } from "@/lib/debate-challenges/ai";
import { ensureRebuttalDrillTables } from "@/lib/rebuttal-drills/ensure-tables";
import {
  advanceDrill,
  countAiDrillsSince,
  countOpenDrills,
  drillViewsFor,
  findOpenDrillFor,
  insertDrillRow,
  joinWaitingDrill,
  loadDrillBoard,
  notifyDrillPlayers,
} from "@/lib/rebuttal-drills/store";
import { createDrill } from "@debate-ai/practice-rounds/src/rebuttal-playlists/rules";
import { parseNewRebuttalDrill } from "@debate-ai/practice-rounds/src/rebuttal-playlists/validation";
import { lastRebuttalName } from "@debate-ai/practice-rounds/src/rebuttal-playlists/prompts";
import { MAX_AI_DRILLS_PER_DAY, MAX_OPEN_DRILLS } from "@debate-ai/practice-rounds/src/rebuttal-playlists/types";

/**
 * Rebuttal Playlists — redo the last rebuttals of curated rounds, paired
 * Aff vs Neg with another student or the AI
 * (`@debate-ai/practice-rounds/src/rebuttal-playlists`).
 *
 * GET — the viewer's drills (their playlist progress is counted from these on
 *   the page), plus how many other students are waiting for a partner on each
 *   video and side. A couple of waiting AI rebuttals or judgings are run first.
 *   Account-only, 401 without a session.
 *
 * POST { playlistId, videoId, side, partner: "partner" | "ai" } — with
 *   `partner`, joins the oldest drill on that video waiting for this side (and
 *   tells its starter), or starts one that waits for a partner. With `ai`, the
 *   AI takes the other side and writes its rebuttal before this answers.
 *   Returns `{ drill, joined }` (201). Starting again on a video and side the
 *   viewer already has open returns that drill (200).
 *
 * Refused when: guests ask for a human partner; the viewer has
 * {@link MAX_OPEN_DRILLS} open drills; or they have started
 * {@link MAX_AI_DRILLS_PER_DAY} AI drills today.
 */

export const GET = withRouteErrors("GET /api/rebuttal-drills", async (req: NextRequest) => {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "Sign in to track your rebuttal drills." }, { status: 401 });

  const db = await getDBFromContext();
  await ensureRebuttalDrillTables(db);
  const viewer = await getViewer(db, userId);
  if (!viewer) return NextResponse.json({ error: "Sign in to track your rebuttal drills." }, { status: 401 });

  const board = await loadDrillBoard(
    db,
    { id: viewer.id, name: viewer.name, imageUrl: viewer.imageUrl },
    await loadBlockedIds(db, userId),
    challengeTextGenerator(req),
    Math.floor(Date.now() / 1000),
  );
  return NextResponse.json(board, { headers: { "Cache-Control": "no-store" } });
});

export const POST = withRouteErrors("POST /api/rebuttal-drills", async (req: NextRequest) => {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "Sign in to start a drill." }, { status: 401 });

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  const parsed = parseNewRebuttalDrill(payload);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const input = parsed.value;

  const db = await getDBFromContext();
  await ensureRebuttalDrillTables(db);
  const viewer = await getViewer(db, userId);
  if (!viewer) return NextResponse.json({ error: "Sign in to start a drill." }, { status: 401 });
  const nowSeconds = Math.floor(Date.now() / 1000);

  const existing = await findOpenDrillFor(db, userId, input.playlistId, input.videoId, input.side);
  if (existing) {
    const [view] = await drillViewsFor(db, [existing], userId, nowSeconds);
    return NextResponse.json({ drill: view, joined: false });
  }

  if (input.partner === "partner" && viewer.isAnonymous) {
    return NextResponse.json({ error: "Create an account to pair with other students — or drill against the AI." }, { status: 403 });
  }
  if ((await countOpenDrills(db, userId)) >= MAX_OPEN_DRILLS) {
    return NextResponse.json(
      { error: `You have ${MAX_OPEN_DRILLS} drills open — finish or cancel one first.` },
      { status: 429 },
    );
  }

  if (input.partner === "partner") {
    const joined = await joinWaitingDrill(
      db,
      userId,
      input.videoId,
      input.playlistId,
      input.side,
      await loadBlockedIds(db, userId),
      nowSeconds,
    );
    if (joined) {
      await notifyDrillPlayers(
        db,
        [joined.creatorId],
        `${viewer.name} joined your rebuttal drill`,
        `They're redoing the ${lastRebuttalName(input.video.format, input.side)} on “${joined.topic}”.`,
      );
      const [view] = await drillViewsFor(db, [joined], userId, nowSeconds);
      return NextResponse.json({ drill: view, joined: true }, { status: 201 });
    }
  } else {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    if ((await countAiDrillsSince(db, userId, since)) >= MAX_AI_DRILLS_PER_DAY) {
      return NextResponse.json(
        { error: `You can start ${MAX_AI_DRILLS_PER_DAY} AI drills a day — pair with a student or come back tomorrow.` },
        { status: 429 },
      );
    }
  }

  let row = await insertDrillRow(db, {
    id: crypto.randomUUID(),
    playlistId: input.playlistId,
    videoId: input.videoId,
    format: input.video.format,
    topic: input.video.title,
    state: createDrill({ creatorId: userId, side: input.side, vsAi: input.partner === "ai" }, nowSeconds),
  });
  if (input.partner === "ai") row = await advanceDrill(db, row, challengeTextGenerator(req), nowSeconds);

  const [view] = await drillViewsFor(db, [row], userId, nowSeconds);
  return NextResponse.json({ drill: view, joined: false }, { status: 201 });
});
