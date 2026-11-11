import { NextRequest, NextResponse } from "next/server";
import { getDBFromContext } from "@/lib/database/context";
import { getUserId } from "@/lib/auth/session";
import { getEnv } from "@/lib/env";
import { withRouteErrors } from "@/lib/api/route-errors";
import { getMarketViewer } from "@/lib/market/queries";
import { topUpById, topUpCheckoutUrl, type TopUpCheckout } from "@debate-ai/file-market";

/**
 * Starts a wallet top-up.
 *
 * POST { topUp: "usd-10" } — answers the top-up's Stripe Payment Link, tagged
 *   with the viewer's id (`client_reference_id`) and prefilled with their
 *   email, for the browser to open. Where Stripe sends the reader afterwards
 *   is set on the Payment Link in the Stripe dashboard.
 *
 * The wallet is credited by `/api/stripe/webhook` once Stripe reports the
 * payment, never by this route. 503 when `STRIPE_WEBHOOK_SECRET` isn't set,
 * since the payment could never be credited.
 */
export const POST = withRouteErrors("POST /api/market/top-up", async (req: NextRequest) => {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "Sign in to add money." }, { status: 401 });

  let payload: { topUp?: unknown };
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  const option = topUpById(payload?.topUp);
  if (!option) return NextResponse.json({ error: "Pick the $10 credit." }, { status: 400 });

  if (!getEnv("STRIPE_WEBHOOK_SECRET")) {
    return NextResponse.json({ error: "Payments aren't set up on this site yet." }, { status: 503 });
  }

  const db = await getDBFromContext();
  const viewer = await getMarketViewer(db, userId);
  if (!viewer) return NextResponse.json({ error: "Sign in to add money." }, { status: 401 });
  if (viewer.isAnonymous) {
    return NextResponse.json({ error: "Create an account to add money." }, { status: 403 });
  }

  const body: TopUpCheckout = { url: topUpCheckoutUrl(option, { userId, email: viewer.email }) };
  return NextResponse.json(body);
});
