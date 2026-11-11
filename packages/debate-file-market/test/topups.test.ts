import { describe, expect, it } from "vitest";
import { TOP_UPS, TOP_UP_PURPOSE, topUpById, topUpCheckoutUrl, topUpForEvent } from "../src/topups";

const LINK = "https://buy.stripe.com/4gMeVf2Oyb6xd4efjAgA802";

/** A session from the $10 credit Payment Link. */
function linkCheckout(overrides: Record<string, unknown> = {}, type = "checkout.session.completed") {
  return {
    type,
    data: {
      object: {
        id: "cs_live_1",
        mode: "payment",
        payment_status: "paid",
        currency: "usd",
        amount_subtotal: 1000,
        amount_total: 1000,
        payment_link: "plink_1",
        client_reference_id: "user-1",
        metadata: {},
        ...overrides,
      },
    },
  };
}

/** A server-created session from the old top-up flow. */
function legacyCheckout(overrides: Record<string, unknown> = {}) {
  return linkCheckout({
    payment_link: null,
    amount_subtotal: undefined,
    metadata: { purpose: TOP_UP_PURPOSE, top_up: "usd-10", user_id: "user-1" },
    ...overrides,
  });
}

describe("top-up options", () => {
  it("offers only the $10 credit Payment Link", () => {
    expect(TOP_UPS).toHaveLength(1);
    expect(TOP_UPS[0]).toMatchObject({ id: "usd-10", amountCents: 1000, paymentLink: LINK });
    expect(topUpById("usd-20")).toBeNull();
    expect(topUpById("usd-5")).toBeNull();
  });

  it("tags the Payment Link with the account", () => {
    const url = new URL(topUpCheckoutUrl(TOP_UPS[0], { userId: "user-1", email: "a@example.test" }));
    expect(url.origin + url.pathname).toBe(LINK);
    expect(url.searchParams.get("client_reference_id")).toBe("user-1");
    expect(url.searchParams.get("prefilled_email")).toBe("a@example.test");
  });

  it("leaves out ids Stripe would reject", () => {
    const url = new URL(topUpCheckoutUrl(TOP_UPS[0], { userId: "bad id!" }));
    expect(url.searchParams.has("client_reference_id")).toBe(false);
    expect(url.searchParams.has("prefilled_email")).toBe(false);
  });
});

describe("topUpForEvent", () => {
  it("reads a paid Payment Link top-up", () => {
    expect(topUpForEvent(linkCheckout())).toEqual({ sessionId: "cs_live_1", userId: "user-1", topUp: "usd-10", amountCents: 1000 });
    expect(topUpForEvent(linkCheckout({}, "checkout.session.async_payment_succeeded"))?.amountCents).toBe(1000);
  });

  it("credits the pre-tax amount when tax is added on top", () => {
    expect(topUpForEvent(linkCheckout({ amount_total: 1088 }))?.amountCents).toBe(1000);
  });

  it("still reads a server-created top-up from the old flow", () => {
    expect(topUpForEvent(legacyCheckout())?.amountCents).toBe(1000);
    expect(topUpForEvent(legacyCheckout({ client_reference_id: null }))?.userId).toBe("user-1");
  });

  it("ignores subscriptions, other payments and unpaid sessions", () => {
    expect(topUpForEvent(linkCheckout({ mode: "subscription" }))).toBeNull();
    expect(topUpForEvent(linkCheckout({ payment_link: null }))).toBeNull();
    expect(topUpForEvent(linkCheckout({ amount_subtotal: 2000, amount_total: 2000 }))).toBeNull();
    expect(topUpForEvent(linkCheckout({ payment_status: "unpaid" }))).toBeNull();
    expect(topUpForEvent(linkCheckout({ currency: "eur" }))).toBeNull();
    expect(topUpForEvent(linkCheckout({ client_reference_id: null }))).toBeNull();
    expect(topUpForEvent(linkCheckout({}, "customer.subscription.updated"))).toBeNull();
  });

  it("never credits more than the option, nor nothing", () => {
    expect(topUpForEvent(legacyCheckout({ amount_total: 99_999 }))?.amountCents).toBe(1000);
    expect(topUpForEvent(legacyCheckout({ amount_total: 800 }))?.amountCents).toBe(800);
    expect(topUpForEvent(legacyCheckout({ amount_total: 0 }))).toBeNull();
  });
});
