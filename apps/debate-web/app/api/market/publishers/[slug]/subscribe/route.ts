import { NextResponse } from "next/server";
import { getDBFromContext } from "@/lib/database/context";
import { getUserId } from "@/lib/auth/session";
import { withRouteErrors } from "@/lib/api/route-errors";
import { getMarketViewer, PurchaseRefused } from "@/lib/market/queries";
import { getPublisherBySlug, publisherPage, subscribe } from "@/lib/market/publishers";

/**
 * Subscribes to a research publisher.
 *
 * POST — starts (or, once lapsed, renews) a one-month subscription. A paid
 *   one moves the monthly price from the viewer's wallet to the owner's.
 *   Answers the refreshed publisher page.
 *
 * Refused with 402 when the wallet doesn't cover the price, 409 for the
 * owner or a reader whose month hasn't run out. Guest accounts can't.
 */
export const POST = withRouteErrors(
  "POST /api/market/publishers/[slug]/subscribe",
  async (_req: Request, context: { params: Promise<{ slug: string }> }) => {
    const userId = await getUserId();
    if (!userId) return NextResponse.json({ error: "Sign in to subscribe." }, { status: 401 });
    const db = await getDBFromContext();
    const viewer = await getMarketViewer(db, userId);
    if (!viewer) return NextResponse.json({ error: "Sign in to subscribe." }, { status: 401 });
    if (viewer.isAnonymous) return NextResponse.json({ error: "Create an account to subscribe." }, { status: 403 });

    const row = await getPublisherBySlug(db, (await context.params).slug);
    if (!row) return NextResponse.json({ error: "There's no publisher at this address." }, { status: 404 });

    try {
      await subscribe(db, row, userId);
    } catch (err) {
      if (err instanceof PurchaseRefused) return NextResponse.json({ error: err.message }, { status: err.status });
      throw err;
    }
    return NextResponse.json(await publisherPage(db, row, userId), { status: 201 });
  },
);
