/**
 * @fileoverview Adding money to a wallet with Stripe.
 *
 * A top-up is a one-off Stripe Checkout Session for a fixed amount, created
 * server-side with `STRIPE_SECRET_KEY` and tagged with the buyer's user id
 * (`client_reference_id`) and `metadata.purpose`. Stripe then reports the
 * payment to `/api/stripe/webhook`, which credits the wallet once per session
 * — {@link topUpForEvent} is the part of that which reads the event.
 *
 * No Stripe SDK: the session is created with a form-encoded POST, the same way
 * the subscription code reads subscriptions.
 *
 * @module debate-file-market/topups
 */

import type { TopUpId, TopUpOption } from "./types";

export const TOP_UPS: readonly TopUpOption[] = [
  { id: "usd-10", amountCents: 1000, label: "$10" },
  { id: "usd-20", amountCents: 2000, label: "$20" },
];

/** `metadata.purpose` on every top-up session, so the webhook can tell them apart. */
export const TOP_UP_PURPOSE = "wallet_top_up";

export function topUpById(id: unknown): TopUpOption | null {
  return TOP_UPS.find((option) => option.id === id) ?? null;
}

/**
 * The form body of `POST https://api.stripe.com/v1/checkout/sessions` for one
 * top-up.
 */
export function topUpCheckoutParams(input: {
  option: TopUpOption;
  userId: string;
  email?: string | null;
  successUrl: string;
  cancelUrl: string;
}): URLSearchParams {
  const { option } = input;
  const params = new URLSearchParams({
    mode: "payment",
    success_url: input.successUrl,
    cancel_url: input.cancelUrl,
    client_reference_id: input.userId,
    "line_items[0][quantity]": "1",
    "line_items[0][price_data][currency]": "usd",
    "line_items[0][price_data][unit_amount]": String(option.amountCents),
    "line_items[0][price_data][product_data][name]": `Debate AI wallet top-up (${option.label})`,
    "metadata[purpose]": TOP_UP_PURPOSE,
    "metadata[top_up]": option.id,
    "metadata[user_id]": input.userId,
    "payment_intent_data[metadata][purpose]": TOP_UP_PURPOSE,
  });
  if (input.email) params.set("customer_email", input.email);
  return params;
}

/** A paid top-up, read off a Stripe event. */
export interface TopUpCredit {
  sessionId: string;
  userId: string;
  topUp: TopUpId;
  amountCents: number;
}

/**
 * The wallet credit a Stripe event carries, or `null` for any event that is
 * not a paid top-up. `checkout.session.completed` for a delayed payment method
 * arrives unpaid and is ignored here; its `async_payment_succeeded` follow-up
 * credits it. The credit is what Stripe actually charged (`amount_total`),
 * never more than the option's amount.
 */
export function topUpForEvent(event: { type: string; data?: { object?: Record<string, any> } }): TopUpCredit | null {
  if (event.type !== "checkout.session.completed" && event.type !== "checkout.session.async_payment_succeeded") {
    return null;
  }
  const session = event.data?.object ?? {};
  if (session.mode !== "payment" || session.metadata?.purpose !== TOP_UP_PURPOSE) return null;
  if (session.payment_status !== "paid") return null;
  if (typeof session.currency === "string" && session.currency.toLowerCase() !== "usd") return null;
  const option = topUpById(session.metadata?.top_up);
  const userId = session.client_reference_id ?? session.metadata?.user_id;
  if (!option || typeof userId !== "string" || !userId || typeof session.id !== "string") return null;
  const paid = typeof session.amount_total === "number" ? session.amount_total : option.amountCents;
  const amountCents = Math.min(Math.max(0, Math.floor(paid)), option.amountCents);
  if (amountCents <= 0) return null;
  return { sessionId: session.id, userId, topUp: option.id, amountCents };
}
