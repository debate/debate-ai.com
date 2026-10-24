import { NextResponse } from "next/server";
import { getDBFromContext } from "@/lib/database/context";
import { getUserId } from "@/lib/auth/session";
import { getEnv } from "@/lib/env";
import { withRouteErrors } from "@/lib/api/route-errors";
import { ensureWallet, getMarketViewer, listListings } from "@/lib/market/queries";
import { TOP_UPS, type MarketBoardResponse } from "@debate-ai/file-market";

/**
 * The file market — research files for sale, and the viewer's wallet.
 *
 * GET — the viewer's wallet balance (created at zero on first visit; `null`
 *   signed out or on a guest account), the $10 / $20 top-up options and
 *   whether this deployment can take payments (`STRIPE_SECRET_KEY` set), and
 *   the open listings. Readable signed out: browsing and previews are public.
 *
 * Writes: `./listings` (POST, sell a file), `./listings/[id]` (DELETE, stop
 * selling), `./listings/[id]/purchase` (POST), `./listings/[id]/copy`
 * (POST), `./top-up` (POST, start a Stripe Checkout). Top-ups are credited
 * by `/api/stripe/webhook`.
 */
export const GET = withRouteErrors("GET /api/market", async () => {
  const db = await getDBFromContext();
  const userId = await getUserId();
  const viewer = userId ? await getMarketViewer(db, userId) : null;
  const [wallet, listings] = await Promise.all([
    viewer && !viewer.isAnonymous ? ensureWallet(db, viewer.id) : Promise.resolve(null),
    listListings(db),
  ]);
  const body: MarketBoardResponse = {
    wallet,
    topUps: [...TOP_UPS],
    topUpsEnabled: Boolean(getEnv("STRIPE_SECRET_KEY")),
    listings,
  };
  return NextResponse.json(body);
});
