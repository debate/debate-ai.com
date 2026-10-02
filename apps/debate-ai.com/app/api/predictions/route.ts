import { NextResponse } from "next/server";
import { getDBFromContext } from "@/lib/database/context";
import { getUserId } from "@/lib/auth/session";
import { getStaffAccess } from "@/lib/auth/admin";
import { withRouteErrors } from "@/lib/api/route-errors";
import { ensureWallet, getViewer, listLeaders, listMarkets, resolveDueMarkets } from "@/lib/predictions/queries";
import { currentRating } from "@/lib/predictions/ratings";
import type { PredictionBoardResponse } from "@debate/predictions";

/**
 * The prediction-markets board — everything the markets page draws, in one read.
 *
 * GET — the viewer and their wallet (granting the 1000 starting points on a
 *   first visit), every open market and recently settled ones with the
 *   viewer's positions, and the richest wallets. Readable signed out: the
 *   markets are public, only betting needs an account. Guest accounts get no
 *   wallet.
 *
 * Before reading, settles any market whose result is in (hosted Tabroom
 * rounds and events, and rating markets past their close) — see
 * `resolveDueMarkets` in `lib/predictions/queries.ts`. A failure there is
 * logged and does not stop the board.
 *
 * Writes go to `./markets` (POST), `./markets/[marketId]/bets` (POST) and
 * `./markets/[marketId]/resolve` (POST); `./sources` lists hosted rounds and
 * events a market can be tied to.
 */

export const GET = withRouteErrors("GET /api/predictions", async () => {
  const db = await getDBFromContext();
  const now = Math.floor(Date.now() / 1000);

  try {
    await resolveDueMarkets(db, now, currentRating);
  } catch (error) {
    console.error("Prediction market auto-resolution failed:", error);
  }

  const userId = await getUserId();
  const viewer = userId ? await getViewer(db, userId) : null;
  const isStaff = viewer ? (await getStaffAccess()).canEditContent : false;

  const [wallet, markets, leaders] = await Promise.all([
    viewer && !viewer.isAnonymous ? ensureWallet(db, viewer.id) : Promise.resolve(null),
    listMarkets(db, viewer ? { id: viewer.id, isStaff } : null),
    listLeaders(db),
  ]);

  const body: PredictionBoardResponse = { viewer, wallet, markets, leaders };
  return NextResponse.json(body);
});
