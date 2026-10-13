import { describe, expect, it } from "vitest";
import { TOP_UPS, TOP_UP_PURPOSE, topUpById, topUpCheckoutParams, topUpForEvent } from "../src/topups";

function checkout(overrides: Record<string, unknown> = {}, type = "checkout.session.completed") {
  return {
    type,
    data: {
      object: {
        id: "cs_test_1",
        mode: "payment",
        payment_status: "paid",
        currency: "usd",
        amount_total: 1000,
        client_reference_id: "user-1",
        metadata: { purpose: TOP_UP_PURPOSE, top_up: "usd-10", user_id: "user-1" },
        ...overrides,
      },
    },
  };
}

describe("top-up options", () => {
  it("offers $10 and $20", () => {
    expect(TOP_UPS.map((option) => option.amountCents)).toEqual([1000, 2000]);
    expect(topUpById("usd-20")?.amountCents).toBe(2000);
    expect(topUpById("usd-5")).toBeNull();
  });

  it("builds a tagged one-off Checkout Session", () => {
    const params = topUpCheckoutParams({
      option: TOP_UPS[1],
      userId: "user-1",
      email: "a@example.test",
      successUrl: "https://example.test/research/market?topup=success",
      cancelUrl: "https://example.test/research/market?topup=cancelled",
    });
    expect(params.get("mode")).toBe("payment");
    expect(params.get("client_reference_id")).toBe("user-1");
    expect(params.get("line_items[0][price_data][unit_amount]")).toBe("2000");
    expect(params.get("metadata[purpose]")).toBe(TOP_UP_PURPOSE);
    expect(params.get("metadata[top_up]")).toBe("usd-20");
    expect(params.get("customer_email")).toBe("a@example.test");
  });
});

describe("topUpForEvent", () => {
  it("reads a paid top-up", () => {
    expect(topUpForEvent(checkout())).toEqual({ sessionId: "cs_test_1", userId: "user-1", topUp: "usd-10", amountCents: 1000 });
    expect(topUpForEvent(checkout({}, "checkout.session.async_payment_succeeded"))?.amountCents).toBe(1000);
  });

  it("ignores subscriptions, other payments and unpaid sessions", () => {
    expect(topUpForEvent(checkout({ mode: "subscription" }))).toBeNull();
    expect(topUpForEvent(checkout({ metadata: {} }))).toBeNull();
    expect(topUpForEvent(checkout({ payment_status: "unpaid" }))).toBeNull();
    expect(topUpForEvent(checkout({ currency: "eur" }))).toBeNull();
    expect(topUpForEvent(checkout({}, "customer.subscription.updated"))).toBeNull();
  });

  it("never credits more than the option, nor nothing", () => {
    expect(topUpForEvent(checkout({ amount_total: 99_999 }))?.amountCents).toBe(1000);
    expect(topUpForEvent(checkout({ amount_total: 800 }))?.amountCents).toBe(800);
    expect(topUpForEvent(checkout({ amount_total: 0 }))).toBeNull();
  });

  it("falls back to the metadata user id", () => {
    expect(topUpForEvent(checkout({ client_reference_id: null }))?.userId).toBe("user-1");
  });
});
