/**
 * @fileoverview Adding money to a wallet with Stripe.
 *
 * A top-up is the fixed-amount "Debate AI $10 Credit" Stripe Payment Link,
 * opened with the buyer's user id as `client_reference_id` (and their email
 * prefilled) — the same way the subscription plans' Payment Links are tagged.
 * Stripe then reports the payment to `/api/stripe/webhook`, which credits the
 * wallet once per Checkout Session — {@link topUpForEvent} is the part of that
 * which reads the event.
 *
 * Older top-ups were Checkout Sessions the server created itself, tagged with
 * `metadata.purpose`; those are still recognised so a late delivery credits.
 *
 * @module debate-file-market/topups
 */

import type { TopUpId, TopUpOption } from "./types";

export const TOP_UPS: readonly TopUpOption[] = [
  {
    id: "usd-10",
    amountCents: 1000,
    label: "$10",
    paymentLink: "https://buy.stripe.com/4gMeVf2Oyb6xd4efjAgA802",
  },
];

/** `metadata.purpose` on server-created top-up sessions (the pre-Payment-Link flow). */
export const TOP_UP_PURPOSE = "wallet_top_up";

export function topUpById(id: unknown): TopUpOption | null {
  return TOP_UPS.find((option) => option.id === id) ?? null;
}

function topUpByAmount(amountCents: unknown): TopUpOption | null {
  return TOP_UPS.find((option) => option.amountCents === amountCents) ?? null;
}

/**
 * The top-up's Payment Link, tagged with `client_reference_id` (echoed back on
 * `checkout.session.completed`, which is how the webhook knows whose wallet to
 * credit) and prefilled with the account email.
 */
export function topUpCheckoutUrl(option: TopUpOption, account: { userId: string; email?: string | null }): string {
  const url = new URL(option.paymentLink);
  // Stripe only accepts alphanumerics, dashes and underscores (max 200 chars).
  if (/^[\w-]{1,200}$/.test(account.userId)) url.searchParams.set("client_reference_id", account.userId);
  if (account.email) url.searchParams.set("prefilled_email", account.email);
  return url.toString();
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
 * not a paid top-up. A top-up is a paid one-off (`payment` mode) USD session
 * that either came from a Payment Link for exactly a top-up amount, or carries
 * the old `metadata.purpose` tag. Subscription Payment Links are `subscription`
 * mode and never match.
 *
 * `checkout.session.completed` for a delayed payment method arrives unpaid and
 * is ignored here; its `async_payment_succeeded` follow-up credits it. The
 * credit is what Stripe charged before tax (`amount_subtotal`, else
 * `amount_total`), never more than the option's amount.
 */
export function topUpForEvent(event: { type: string; data?: { object?: Record<string, any> } }): TopUpCredit | null {
  if (event.type !== "checkout.session.completed" && event.type !== "checkout.session.async_payment_succeeded") {
    return null;
  }
  const session = event.data?.object ?? {};
  if (session.mode !== "payment") return null;
  if (session.payment_status !== "paid") return null;
  if (typeof session.currency === "string" && session.currency.toLowerCase() !== "usd") return null;

  // Pre-tax amount: Stripe Managed Payments can add tax on top of the $10.
  const charged = typeof session.amount_subtotal === "number" ? session.amount_subtotal : session.amount_total;
  let option: TopUpOption | null = null;
  if (session.metadata?.purpose === TOP_UP_PURPOSE) {
    option = topUpById(session.metadata?.top_up);
  } else if (session.payment_link) {
    option = topUpByAmount(charged);
  }
  const userId = session.client_reference_id ?? session.metadata?.user_id;
  if (!option || typeof userId !== "string" || !userId || typeof session.id !== "string") return null;
  const paid = typeof charged === "number" ? charged : option.amountCents;
  const amountCents = Math.min(Math.max(0, Math.floor(paid)), option.amountCents);
  if (amountCents <= 0) return null;
  return { sessionId: session.id, userId, topUp: option.id, amountCents };
}
