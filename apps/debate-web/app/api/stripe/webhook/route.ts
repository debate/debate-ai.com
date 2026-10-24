import { NextRequest, NextResponse } from "next/server"
import { getDBFromContext } from "@/lib/database/context"
import { getEnv } from "@/lib/env"
import {
  constructEvent,
  parseSecrets,
  StripeSignatureError,
  subscriptionUpdateForEvent,
} from "@debate-ai/webview/lib/stripe/webhook"
import { fetchSubscription, saveSubscriptionUpdate } from "@/lib/stripe/store"
import { creditTopUp } from "@/lib/market/queries"
import { topUpForEvent } from "@debate-ai/file-market"

/**
 * Stripe webhook endpoint — register `https://debate-ai.com/api/stripe/webhook`
 * in the Stripe dashboard (Developers → Webhooks) for:
 *
 *   checkout.session.completed, checkout.session.async_payment_succeeded,
 *   customer.subscription.created / updated / deleted / paused / resumed
 *
 * and set its signing secret as `STRIPE_WEBHOOK_SECRET` (comma-separate two
 * while rotating). `STRIPE_SECRET_KEY` is optional but recommended: with it,
 * each event re-reads the live subscription so out-of-order deliveries can't
 * leave a stale status.
 *
 * The same checkout events also carry wallet top-ups (one-off `payment` mode
 * sessions started by `/api/market/top-up`, tagged `metadata.purpose =
 * wallet_top_up`); a paid one credits the buyer's wallet once per session.
 *
 * Responds 400 to an unverifiable request (Stripe will not retry those), 500
 * when the write fails (Stripe retries), and 200 otherwise — including for
 * event types we ignore, so they don't pile up as failed deliveries.
 */
export async function POST(req: NextRequest) {
  const payload = await req.text()

  let event
  try {
    event = await constructEvent(
      payload,
      req.headers.get("stripe-signature"),
      parseSecrets(getEnv("STRIPE_WEBHOOK_SECRET")),
    )
  } catch (error) {
    if (error instanceof StripeSignatureError || error instanceof SyntaxError) {
      console.warn("Rejected Stripe webhook:", error.message)
      return NextResponse.json({ error: "Invalid signature" }, { status: 400 })
    }
    throw error
  }

  const topUp = topUpForEvent(event)
  if (topUp) {
    try {
      const db = await getDBFromContext()
      const credited = await creditTopUp(db, topUp)
      return NextResponse.json({ received: true, topUp: topUp.sessionId, credited })
    } catch (error) {
      console.error(`Failed to credit Stripe top-up ${event.id} (${event.type})`, error)
      return NextResponse.json({ error: "Failed to process event" }, { status: 500 })
    }
  }

  const update = subscriptionUpdateForEvent(event)
  if (!update) {
    return NextResponse.json({ received: true, ignored: event.type })
  }

  try {
    const live = await fetchSubscription(update.subscriptionId, getEnv("STRIPE_SECRET_KEY"))
    // The live read wins on status/plan/period, while the checkout event
    // still contributes what only it carries (our user id and the email).
    const merged = live ? { ...update, ...live } : update
    const db = await getDBFromContext()
    await saveSubscriptionUpdate(db, merged)
    return NextResponse.json({ received: true, subscription: update.subscriptionId })
  } catch (error) {
    console.error(`Failed to process Stripe event ${event.id} (${event.type})`, error)
    return NextResponse.json({ error: "Failed to process event" }, { status: 500 })
  }
}
