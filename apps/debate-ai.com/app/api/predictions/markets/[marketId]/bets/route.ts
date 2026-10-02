import { NextRequest, NextResponse } from "next/server";
import { getDBFromContext } from "@/lib/database/context";
import { getUserId } from "@/lib/auth/session";
import { getStaffAccess } from "@/lib/auth/admin";
import { withRouteErrors } from "@/lib/api/route-errors";
import { BetRefused, ensureWallet, getMarket, getMarketRow, getViewer, placeBet } from "@/lib/predictions/queries";
import { parseNewBet, readStoredArray, type BetResult, type MarketOutcome } from "debate-predictions";

/**
 * Places a bet.
 *
 * POST { outcomeId, stake } — spends `stake` whole points from the viewer's
 *   wallet on `outcomeId` at the market maker's current price, and returns the
 *   market, the wallet and the shares bought. Each share pays one point if
 *   that outcome wins.
 *
 * Refused (409) when betting has closed, the wallet cannot cover the stake,
 * or another bet moved the price first (the stake is refunded; try again at
 * the new price). Guest accounts cannot bet.
 */

export const POST = withRouteErrors(
  "POST /api/predictions/markets/[marketId]/bets",
  async (req: NextRequest, context: { params: Promise<{ marketId: string }> }) => {
    const userId = await getUserId();
    if (!userId) {
      return NextResponse.json({ error: "Sign in to place a bet." }, { status: 401 });
    }

    let payload: unknown;
    try {
      payload = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
    }

    const db = await getDBFromContext();
    const viewer = await getViewer(db, userId);
    if (!viewer) {
      return NextResponse.json({ error: "Sign in to place a bet." }, { status: 401 });
    }
    if (viewer.isAnonymous) {
      return NextResponse.json({ error: "Create an account to place a bet." }, { status: 403 });
    }

    const { marketId } = await context.params;
    const market = await getMarketRow(db, marketId);
    if (!market) {
      return NextResponse.json({ error: "That market doesn't exist." }, { status: 404 });
    }

    const wallet = await ensureWallet(db, userId);
    const parsed = parseNewBet(payload, readStoredArray<MarketOutcome>(market.outcomes), wallet.balance);
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    let shares: number;
    try {
      shares = await placeBet(db, {
        market,
        userId,
        outcomeId: parsed.value.outcomeId,
        stake: parsed.value.stake,
        now: Math.floor(Date.now() / 1000),
      });
    } catch (error) {
      if (error instanceof BetRefused) {
        return NextResponse.json({ error: error.message }, { status: error.status });
      }
      throw error;
    }

    const isStaff = (await getStaffAccess()).canEditContent;
    const body: BetResult = {
      market: (await getMarket(db, marketId, { id: userId, isStaff }))!,
      wallet: await ensureWallet(db, userId),
      shares,
    };
    return NextResponse.json(body, { status: 201 });
  },
);
