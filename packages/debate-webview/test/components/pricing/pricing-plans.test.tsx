/**
 * @fileoverview The pricing cards shown when a plan limit is hit: a card per
 * tier, the next tier up recommended, upgrade links only above the current
 * plan, and a comparison table built from the tier limits.
 */

import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { describeLimits, limitsFor } from "../../../src/lib/stripe/limits";
import { PLANS } from "../../../src/lib/stripe/plans";
import { PricingPlans, type SubscriptionInfo } from "../../../src/components/pricing/PricingPlans";

const info = (subscription: SubscriptionInfo["subscription"], tier: SubscriptionInfo["tier"]): SubscriptionInfo => ({
  subscription,
  tier,
  plans: PLANS.map((plan) => ({
    id: plan.id,
    name: plan.name,
    amount: plan.amount,
    checkoutUrl: `${plan.paymentLink}?client_reference_id=u1`,
    limits: limitsFor(plan.id),
    features: describeLimits(limitsFor(plan.id)),
  })),
  free: { limits: limitsFor("free"), features: describeLimits(limitsFor("free")) },
  usage: { llmRequests: 10, cardAiAnalyses: 0, cardSearches: 0 },
});

const card = (html: string, id: string) => html.split(`data-plan="${id}"`)[1]?.split("data-plan=")[0] ?? "";

describe("PricingPlans", () => {
  it("recommends Pro to a free user and links both paid plans", () => {
    const html = renderToStaticMarkup(<PricingPlans info={info(null, "free")} />);
    expect(card(html, "free")).toContain("Current plan");
    expect(card(html, "pro-vip")).toContain("Recommended");
    expect(card(html, "pro-vip")).toContain("$5");
    expect(card(html, "research-team")).toContain("$49");
    for (const plan of PLANS) expect(html).toContain(`${plan.paymentLink}?client_reference_id=u1`);
  });

  it("recommends Research Team to a Pro subscriber and doesn't sell Pro again", () => {
    const html = renderToStaticMarkup(
      <PricingPlans
        info={info({ plan: "pro-vip", status: "active", currentPeriodEnd: null, cancelAtPeriodEnd: false }, "pro-vip")}
      />,
    );
    expect(card(html, "pro-vip")).toContain("Current plan");
    expect(card(html, "pro-vip")).not.toContain("buy.stripe.com");
    expect(card(html, "research-team")).toContain("Recommended");
  });

  it("compares every limit, with unlimited and missing features spelled out", () => {
    const html = renderToStaticMarkup(<PricingPlans info={info(null, "free")} />);
    expect(html).toContain("Compare features");
    expect(html).toContain("Card searches");
    expect(html).toContain("Unlimited");
    expect(html).toContain("Not included");
    expect(html).toContain("1,000");
  });
});
