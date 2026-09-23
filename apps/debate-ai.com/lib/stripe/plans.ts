/**
 * The paid plans sold through Stripe Payment Links. Checkout happens entirely
 * on Stripe's hosted page; the app only builds the link (tagged with the
 * signed-in user's id so the webhook can attribute the purchase) and learns
 * the outcome from `/api/stripe/webhook`.
 *
 * Price ids are what the webhook sees on a subscription, so they are the key
 * that maps a Stripe event back to a plan. Update both together if a price is
 * ever replaced in the Stripe dashboard.
 */

export type PlanId = "pro-vip" | "research-team";

export interface Plan {
  id: PlanId;
  name: string;
  /** Monthly price in USD cents. */
  amount: number;
  priceId: string;
  paymentLink: string;
}

export const PLANS: readonly Plan[] = [
  {
    id: "pro-vip",
    name: "Debate AI Pro VIP",
    amount: 500,
    priceId: "price_1UIl7fRcscx6rqBPHiUZ7WJv",
    paymentLink: "https://buy.stripe.com/9B6bJ3exga2tc0a2wOgA801",
  },
  {
    id: "research-team",
    name: "Debate AI Research Team",
    amount: 4900,
    priceId: "price_1UIl5xRcscx6rqBPGiRE9UDk",
    paymentLink: "https://buy.stripe.com/bJeeVfah0b6xc0a6N4gA800",
  },
];

/** Subscription statuses that still grant the plan's features. */
export const ACTIVE_STATUSES: ReadonlySet<string> = new Set(["active", "trialing", "past_due"]);

export function planForPrice(priceId: string | null | undefined): PlanId | "unknown" {
  return PLANS.find((plan) => plan.priceId === priceId)?.id ?? "unknown";
}

/**
 * The plan's Payment Link, tagged with `client_reference_id` (echoed back on
 * `checkout.session.completed`) and prefilled with the account email so the
 * purchase lands on the right account.
 */
export function checkoutUrl(plan: Plan, account?: { userId?: string | null; email?: string | null }): string {
  const url = new URL(plan.paymentLink);
  // Stripe only accepts alphanumerics, dashes and underscores (max 200 chars).
  if (account?.userId && /^[\w-]{1,200}$/.test(account.userId)) {
    url.searchParams.set("client_reference_id", account.userId);
  }
  if (account?.email) url.searchParams.set("prefilled_email", account.email);
  return url.toString();
}
