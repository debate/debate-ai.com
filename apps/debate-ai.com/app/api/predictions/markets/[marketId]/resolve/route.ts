import { NextRequest, NextResponse } from "next/server";
import { getDBFromContext } from "@/lib/database/context";
import { getUserId } from "@/lib/auth/session";
import { getStaffAccess } from "@/lib/auth/admin";
import { withRouteErrors } from "@/lib/api/route-errors";
import { getMarket, getMarketRow, settleMarket } from "@/lib/predictions/queries";
import { parseResolve, readStoredArray, type MarketOutcome } from "debate-predictions";

/**
 * Settles a market by hand.
 *
 * POST { outcomeId, note? } — pays every share of `outcomeId` one point, or,
 *   with `outcomeId: null`, voids the market and refunds every stake. Returns
 *   the market as it now stands.
 *
 * Who may: moderators and admins on any open market; the creator of a
 * hand-written market only while they hold no position in it (the rule is
 * `canResolveMarket` in `debate-predictions`, which the page uses to decide
 * whether to show the controls). Markets tied to hosted Tabroom data or to the
 * rankings settle themselves on the next board read.
 */

export const POST = withRouteErrors(
  "POST /api/predictions/markets/[marketId]/resolve",
  async (req: NextRequest, context: { params: Promise<{ marketId: string }> }) => {
    const userId = await getUserId();
    if (!userId) {
      return NextResponse.json({ error: "Sign in to settle a market." }, { status: 401 });
    }

    let payload: unknown;
    try {
      payload = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
    }

    const db = await getDBFromContext();
    const { marketId } = await context.params;
    const row = await getMarketRow(db, marketId);
    if (!row) {
      return NextResponse.json({ error: "That market doesn't exist." }, { status: 404 });
    }

    const isStaff = (await getStaffAccess()).canEditContent;
    const viewer = { id: userId, isStaff };
    const market = await getMarket(db, marketId, viewer);
    if (!market?.canResolve) {
      return NextResponse.json(
        {
          error:
            market?.status !== "open"
              ? "This market has already settled."
              : "Only a moderator, or the creator while they have no bet on it, can settle this market.",
        },
        { status: 403 },
      );
    }

    const parsed = parseResolve(payload, readStoredArray<MarketOutcome>(row.outcomes));
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    const note = parsed.value.note || (parsed.value.outcomeId === null ? "Voided by hand." : "Settled by hand.");
    if (!(await settleMarket(db, marketId, parsed.value.outcomeId, note))) {
      return NextResponse.json({ error: "This market has already settled." }, { status: 409 });
    }
    return NextResponse.json(await getMarket(db, marketId, viewer));
  },
);
