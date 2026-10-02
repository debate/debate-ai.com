import { NextResponse } from "next/server";
import { getDBFromContext } from "@/lib/database/context";
import { getUserId } from "@/lib/auth/session";
import { withRouteErrors } from "@/lib/api/route-errors";
import {
  getProfile,
  getViewer,
  listChallengesFor,
  listOpenToJudge,
  listVolunteers,
  loadBlockedIds,
} from "@/lib/practice-partners/queries";
import type { PracticeBoardResponse } from "@debate/webview/lib/practice-partners/types";

/**
 * The practice board — everything the Practice Partners panel draws, in one read.
 *
 * GET — the viewer, their own practice profile, everyone else volunteering to
 *   debate or judge (minus blocks and guest accounts), every challenge the
 *   viewer is in, and — for judge volunteers only — accepted rounds that still
 *   need a judge. Account-only, 401 without a session: the board lists real
 *   people who asked to be contacted by members, not by the open web. See
 *   `lib/practice-partners/queries.ts`.
 *
 * Writes go to `./profile` (PUT) and `./challenges` (POST, then PATCH per id).
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
  const [volunteers, openToJudge] = await Promise.all([
    listVolunteers(db, userId, blocked),
    profile?.asJudge ? listOpenToJudge(db, userId, blocked, nowSeconds) : Promise.resolve([]),
  ]);

  const body: PracticeBoardResponse = {
    viewer: { id: viewer.id, name: viewer.name, imageUrl: viewer.imageUrl },
    profile,
    volunteers,
    challenges,
    openToJudge,
  };
  return NextResponse.json(body);
});
