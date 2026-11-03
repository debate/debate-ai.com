import { NextResponse } from "next/server";
import { getDBFromContext } from "@/lib/database/context";
import { getUserId } from "@/lib/auth/session";
import { withRouteErrors } from "@/lib/api/route-errors";
import {
  getProfile,
  getViewer,
  listChallengesFor,
  listCoachingSignups,
  listOpenToJudge,
  loadBlockedIds,
} from "@/lib/practice-partners/queries";
import type { PracticeBoardResponse } from "@debate-ai/practice-rounds/src/practice-partners/types";

/**
 * The practice board — everything the Practice Partners panel draws, in one read.
 *
 * GET — the viewer, their own practice profile, every challenge the viewer is
 *   in (the other debater anonymous until accepted), and — for judge
 *   volunteers only — accepted rounds that still need a judge — plus the
 *   online-coaching board (volunteer coaches and teams that need a coach, by
 *   name). Account-only,
 *   401 without a session. The list of volunteers is deliberately not here:
 *   partners are found one at a time, anonymously, by `./match`. See
 *   `lib/practice-partners/queries.ts`.
 *
 * Writes go to `./profile` (PUT), `./match` (POST) and `./challenges` (POST,
 * then PATCH per id).
 */

export const GET = withRouteErrors("GET /api/practice-partners", async () => {
  const userId = await getUserId();
  if (!userId) {
    return NextResponse.json({ error: "Sign in to find practice partners." }, { status: 401 });
  }

  const db = await getDBFromContext();
  const viewer = await getViewer(db, userId);
  if (!viewer) {
    return NextResponse.json({ error: "Sign in to find practice partners." }, { status: 401 });
  }

  const nowSeconds = Math.floor(Date.now() / 1000);
  const [profile, blocked, challenges] = await Promise.all([
    getProfile(db, userId),
    loadBlockedIds(db, userId),
    listChallengesFor(db, userId),
  ]);
  const [openToJudge, coaching] = await Promise.all([
    profile?.asJudge ? listOpenToJudge(db, userId, blocked, nowSeconds) : Promise.resolve([]),
    listCoachingSignups(db, blocked),
  ]);

  const body: PracticeBoardResponse = {
    viewer: { id: viewer.id, name: viewer.name, imageUrl: viewer.imageUrl },
    profile,
    challenges,
    openToJudge,
    coaching,
  };
  return NextResponse.json(body);
});
