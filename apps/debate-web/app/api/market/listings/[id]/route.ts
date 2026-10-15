import { NextResponse } from "next/server";
import { getDBFromContext } from "@/lib/database/context";
import { getUserId } from "@/lib/auth/session";
import { withRouteErrors } from "@/lib/api/route-errors";
import { getListing, stopListing } from "@/lib/market/queries";

type Context = { params: Promise<{ id: string }> };

/**
 * One file for sale.
 *
 * GET — its preview (title, price, seller, table of contents) for anyone;
 *   its full contents too for the seller and for buyers. A listing the
 *   seller stopped is a 404 to everyone else.
 *
 * DELETE — the seller takes it off the market. Buyers keep their access.
 */

export const GET = withRouteErrors("GET /api/market/listings/[id]", async (_req: Request, context: Context) => {
  const { id } = await context.params;
  const db = await getDBFromContext();
  const listing = await getListing(db, id, await getUserId());
  if (!listing) return NextResponse.json({ error: "That file isn't for sale." }, { status: 404 });
  return NextResponse.json({ listing });
});

export const DELETE = withRouteErrors("DELETE /api/market/listings/[id]", async (_req: Request, context: Context) => {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  const { id } = await context.params;
  const db = await getDBFromContext();
  if (!(await stopListing(db, id, userId))) {
    return NextResponse.json({ error: "That isn't one of your listings." }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
});
