import { createHmac } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { checkoutUrl, planForPrice, PLANS } from "../plans";
import { fetchSubscription } from "../store";
import {
  constructEvent,
  parseSecrets,
  signPayload,
  StripeSignatureError,
  subscriptionUpdateForEvent,
  updateFromSubscription,
} from "../webhook";

const SECRET = "whsec_test_secret";
const NOW = 1_790_000_000;
const PRO = PLANS.find((p) => p.id === "pro-vip")!;

const subscription = {
  id: "sub_123",
  object: "subscription",
  customer: "cus_123",
  status: "active",
  cancel_at_period_end: false,
  cancel_at: null,
  items: { data: [{ price: { id: PRO.priceId }, current_period_end: NOW + 30 * 86400 }] },
};

describe("constructEvent", () => {
  const payload = JSON.stringify({ id: "evt_1", type: "customer.subscription.updated", data: { object: subscription } });

  it("accepts a signature computed the way Stripe computes it", async () => {
    // Independent of signPayload: Node's HMAC over `${t}.${payload}`.
    const v1 = createHmac("sha256", SECRET).update(`${NOW}.${payload}`).digest("hex");
    const event = await constructEvent(payload, `t=${NOW},v1=${v1}`, [SECRET], { now: NOW });
    expect(event.id).toBe("evt_1");
  });

  it("matches signPayload's header", async () => {
    const header = await signPayload(payload, SECRET, NOW);
    expect(header).toBe(`t=${NOW},v1=${createHmac("sha256", SECRET).update(`${NOW}.${payload}`).digest("hex")}`);
  });

  it("accepts any of several secrets and any of several v1 signatures", async () => {
    const good = (await signPayload(payload, SECRET, NOW)).split("v1=")[1];
    const header = `t=${NOW},v1=${"0".repeat(64)},v0=ignored,v1=${good}`;
    await expect(constructEvent(payload, header, ["whsec_old", SECRET], { now: NOW })).resolves.toBeTruthy();
  });

  it("rejects a tampered body", async () => {
    const header = await signPayload(payload, SECRET, NOW);
    await expect(constructEvent(payload.replace("active", "canceled"), header, [SECRET], { now: NOW })).rejects.toThrow(
      StripeSignatureError,
    );
  });

  it("rejects the wrong secret, a stale timestamp, and missing/malformed headers", async () => {
    const header = await signPayload(payload, SECRET, NOW);
    await expect(constructEvent(payload, header, ["whsec_other"], { now: NOW })).rejects.toThrow(StripeSignatureError);
    await expect(constructEvent(payload, header, [SECRET], { now: NOW + 301 })).rejects.toThrow(/tolerance/);
    await expect(constructEvent(payload, null, [SECRET], { now: NOW })).rejects.toThrow(/Missing/);
    await expect(constructEvent(payload, "garbage", [SECRET], { now: NOW })).rejects.toThrow(/Malformed/);
    await expect(constructEvent(payload, header, [], { now: NOW })).rejects.toThrow(/No webhook signing secret/);
  });
});

describe("parseSecrets", () => {
  it("splits and trims comma-separated secrets", () => {
    expect(parseSecrets(" whsec_a , whsec_b,,")).toEqual(["whsec_a", "whsec_b"]);
    expect(parseSecrets(undefined)).toEqual([]);
  });
});

describe("subscriptionUpdateForEvent", () => {
  it("links a subscription checkout to the user from client_reference_id", () => {
    const update = subscriptionUpdateForEvent({
      id: "evt_2",
      type: "checkout.session.completed",
      data: {
        object: {
          mode: "subscription",
          subscription: "sub_123",
          customer: "cus_123",
          client_reference_id: "user_abc",
          customer_details: { email: "debater@example.com" },
        },
      },
    });
    expect(update).toEqual({
      subscriptionId: "sub_123",
      userId: "user_abc",
      customerId: "cus_123",
      email: "debater@example.com",
    });
  });

  it("omits userId when the checkout carries no client_reference_id", () => {
    const update = subscriptionUpdateForEvent({
      id: "evt_3",
      type: "checkout.session.completed",
      data: { object: { mode: "subscription", subscription: "sub_1", client_reference_id: null, customer_email: "a@b.c" } },
    });
    expect(update).not.toHaveProperty("userId");
    expect(update?.email).toBe("a@b.c");
  });

  it("ignores one-off payment checkouts and unrelated events", () => {
    expect(
      subscriptionUpdateForEvent({ id: "e", type: "checkout.session.completed", data: { object: { mode: "payment" } } }),
    ).toBeNull();
    expect(subscriptionUpdateForEvent({ id: "e", type: "charge.succeeded", data: { object: {} } })).toBeNull();
  });

  it("reads plan, status and period end from subscription events", () => {
    const update = subscriptionUpdateForEvent({
      id: "evt_4",
      type: "customer.subscription.deleted",
      data: { object: { ...subscription, status: "canceled" } },
    });
    expect(update).toMatchObject({
      subscriptionId: "sub_123",
      customerId: "cus_123",
      priceId: PRO.priceId,
      plan: "pro-vip",
      status: "canceled",
      currentPeriodEnd: new Date((NOW + 30 * 86400) * 1000),
      cancelAtPeriodEnd: false,
    });
  });

  it("falls back to the subscription-level period end of older API versions", () => {
    const { items, ...rest } = subscription;
    const update = updateFromSubscription({
      ...rest,
      current_period_end: NOW,
      cancel_at_period_end: true,
      items: { data: [{ price: { id: "price_other" } }] },
    });
    expect(update.currentPeriodEnd).toEqual(new Date(NOW * 1000));
    expect(update.plan).toBe("unknown");
    expect(update.cancelAtPeriodEnd).toBe(true);
  });
});

describe("plans", () => {
  it("maps prices to plans", () => {
    for (const plan of PLANS) expect(planForPrice(plan.priceId)).toBe(plan.id);
    expect(planForPrice(undefined)).toBe("unknown");
  });

  it("tags Payment Links with the user id and email", () => {
    const url = new URL(checkoutUrl(PRO, { userId: "user_abc-1", email: "a+b@example.com" }));
    expect(url.origin + url.pathname).toBe(PRO.paymentLink);
    expect(url.searchParams.get("client_reference_id")).toBe("user_abc-1");
    expect(url.searchParams.get("prefilled_email")).toBe("a+b@example.com");
  });

  it("drops a user id Stripe would reject", () => {
    const url = new URL(checkoutUrl(PRO, { userId: "bad id!" }));
    expect(url.searchParams.has("client_reference_id")).toBe(false);
    expect(checkoutUrl(PRO)).toBe(PRO.paymentLink);
  });
});

describe("fetchSubscription", () => {
  it("returns null without a secret key", async () => {
    const fetchImpl = vi.fn();
    expect(await fetchSubscription("sub_123", undefined, fetchImpl as any)).toBeNull();
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("reads the live subscription with the secret key", async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ ...subscription, status: "past_due" })));
    const update = await fetchSubscription("sub_123", "sk_test_x", fetchImpl as any);
    expect(fetchImpl).toHaveBeenCalledWith("https://api.stripe.com/v1/subscriptions/sub_123", {
      headers: { Authorization: "Bearer sk_test_x" },
    });
    expect(update).toMatchObject({ status: "past_due", plan: "pro-vip" });
  });

  it("returns null when Stripe errors", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const fetchImpl = vi.fn(async () => new Response("{}", { status: 404 }));
    expect(await fetchSubscription("sub_x", "sk_test_x", fetchImpl as any)).toBeNull();
  });
});
