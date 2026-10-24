import { NextRequest, NextResponse } from "next/server";
import { getDBFromContext } from "@/lib/database/context";
import { getUserId } from "@/lib/auth/session";
import { getEnv } from "@/lib/env";
import { withRouteErrors } from "@/lib/api/route-errors";
import { getMarketViewer } from "@/lib/market/queries";
import { topUpById, topUpCheckoutParams, type TopUpCheckout } from "@debate-ai/file-market";

const STRIPE_CHECKOUT_SESSIONS = "https://api.stripe.com/v1/checkout/sessions";

/** A same-site path to come back to, or the market page. */
function safeReturnPath(value: unknown): string {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) {
    return "/research/market";
  }
  return value.split("#")[0];
}

function withParam(path: string, key: string, value: string): string {
  return `${path}${path.includes("?") ? "&" : "?"}${key}=${value}`;
}

/**
 * Starts a wallet top-up.
 *
 * POST { topUp: "usd-10" | "usd-20", returnTo? } — creates a one-off Stripe
 *   Checkout Session for that amount, tagged with the viewer's id, and answers
 *   its hosted payment page's URL for the browser to open. `returnTo` (a path
 *   on this site) is where Stripe sends the reader back, with
 *   `?topup=success` or `?topup=cancelled`.
 *
 * The wallet is credited by `/api/stripe/webhook` once Stripe reports the
 * payment, never by this route. 503 when `STRIPE_SECRET_KEY` isn't set.
 */
export const POST = withRouteErrors("POST /api/market/top-up", async (req: NextRequest) => {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "Sign in to add money." }, { status: 401 });

  let payload: { topUp?: unknown; returnTo?: unknown };
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  const option = topUpById(payload?.topUp);
  if (!option) return NextResponse.json({ error: "Pick $10 or $20." }, { status: 400 });

  const secretKey = getEnv("STRIPE_SECRET_KEY");
  if (!secretKey) {
    return NextResponse.json({ error: "Payments aren't set up on this site yet." }, { status: 503 });
  }

  const db = await getDBFromContext();
  const viewer = await getMarketViewer(db, userId);
  if (!viewer) return NextResponse.json({ error: "Sign in to add money." }, { status: 401 });
  if (viewer.isAnonymous) {
    return NextResponse.json({ error: "Create an account to add money." }, { status: 403 });
  }

  const origin = req.nextUrl.origin;
  const back = safeReturnPath(payload.returnTo);
  const params = topUpCheckoutParams({
    option,
    userId,
    email: viewer.email,
    successUrl: `${origin}${withParam(back, "topup", "success")}`,
    cancelUrl: `${origin}${withParam(back, "topup", "cancelled")}`,
  });

  const res = await fetch(STRIPE_CHECKOUT_SESSIONS, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secretKey}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
  });
  if (!res.ok) {
    console.error(`Stripe Checkout Session creation failed (${res.status})`, await res.text().catch(() => ""));
    return NextResponse.json({ error: "Stripe couldn't start the payment. Try again." }, { status: 502 });
  }
  const session = (await res.json()) as { url?: string };
  if (!session.url) return NextResponse.json({ error: "Stripe didn't return a payment page." }, { status: 502 });
  const body: TopUpCheckout = { url: session.url };
  return NextResponse.json(body);
});
