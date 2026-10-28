import { NextResponse } from "next/server";
import { getDBFromContext } from "@/lib/database/context";
import { getUserId } from "@/lib/auth/session";
import { withRouteErrors } from "@/lib/api/route-errors";
import { getViewer, loadBlockedIds } from "@/lib/practice-partners/queries";
import { getListing, listHiresFor, listPool } from "@/lib/judge-pool/queries";
import { isoDay } from "@debate-ai/practice-rounds/src/judge-pool/season-calendar";
import type { JudgePoolResponse } from "@debate-ai/practice-rounds/src/judge-pool/types";

/**
 * The judge pool — everything the "Volunteer as a judge" and "Hire a judge"
 * blocks draw, in one read.
 *
 * GET — the viewer, their own listing, every other active listing with a
 *   weekend still ahead (blocks and guests excluded), and the hire requests the
 *   viewer sent or received. Account-only, 401 without a session. See
 *   `lib/judge-pool/queries.ts`.
 *
 * Writes go to `./listing` (PUT) and `./hires` (POST, then PATCH per id).
 * No payment is taken: `paymentsConnected` is always `false`.
 */

export const GET = withRouteErrors("GET /api/judge-pool", async () => {
  const userId = await getUserId();
  if (!userId) {
    return NextResponse.json({ error: "Sign in to see the judge pool." }, { status: 401 });
  }

  const db = await getDBFromContext();
  const viewer = await getViewer(db, userId);
  if (!viewer) {
    return NextResponse.json({ error: "Sign in to see the judge pool." }, { status: 401 });
  }

  const today = isoDay();
  const blocked = await loadBlockedIds(db, userId);
  const [listing, pool, hires] = await Promise.all([
    getListing(db, userId, today),
    listPool(db, userId, blocked, today),
    listHiresFor(db, userId),
  ]);

  const body: JudgePoolResponse = {
    viewer: { id: viewer.id, name: viewer.name, imageUrl: viewer.imageUrl },
    listing,
    pool,
    hires,
    paymentsConnected: false,
  };
  return NextResponse.json(body);
});
