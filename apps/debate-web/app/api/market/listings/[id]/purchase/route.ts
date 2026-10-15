import { NextResponse } from "next/server";
import { getDBFromContext } from "@/lib/database/context";
import { getUserId } from "@/lib/auth/session";
import { withRouteErrors } from "@/lib/api/route-errors";
import {
  ensureWallet,
  getListing,
  getListingRow,
  getMarketViewer,
  PurchaseRefused,
  purchaseListing,
} from "@/lib/market/queries";
import type { PurchaseResult } from "@debate/file-market";

/**
 * Buys a file.
 *
 * POST — pays the listing's price from the viewer's wallet to the seller's,
 *   and saves the full file to the viewer's own files. Answers the unlocked
 *   listing, the new balance and the saved copy's document id.
 *
 * Refused with 402 when the wallet doesn't cover the price (top up at
 * `/api/market/top-up`), 409 for the seller or a reader who already owns it,
 * 410 when the seller stopped selling it. Guest accounts can't buy.
 */
export const POST = withRouteErrors(
  "POST /api/market/listings/[id]/purchase",
  async (_req: Request, context: { params: Promise<{ id: string }> }) => {
    const userId = await getUserId();
    if (!userId) return NextResponse.json({ error: "Sign in to buy this file." }, { status: 401 });
    const db = await getDBFromContext();
    const viewer = await getMarketViewer(db, userId);
    if (!viewer) return NextResponse.json({ error: "Sign in to buy this file." }, { status: 401 });
    if (viewer.isAnonymous) {
      return NextResponse.json({ error: "Create an account to buy files." }, { status: 403 });
    }

    const { id } = await context.params;
    const row = await getListingRow(db, id);
    if (!row) return NextResponse.json({ error: "That file isn't for sale." }, { status: 404 });

    let documentId: number;
    try {
      documentId = await purchaseListing(db, row, userId);
    } catch (error) {
      if (error instanceof PurchaseRefused) {
        return NextResponse.json({ error: error.message }, { status: error.status });
      }
      throw error;
    }

    const body: PurchaseResult = {
      listing: (await getListing(db, id, userId))!,
      wallet: await ensureWallet(db, userId),
      documentId,
    };
    return NextResponse.json(body, { status: 201 });
  },
);
