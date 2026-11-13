/**
 * Stripe webhook handling without the SDK: signature verification (rotation,
 * replay window, malformed headers) and the mapping from events to the
 * subscription row they change.
 */
import { describe, expect, it } from "vitest"
import { PLANS } from "../../../src/lib/stripe/plans"
import {
  constructEvent,
  parseSecrets,
  signPayload,
  StripeSignatureError,
  subscriptionUpdateForEvent,
  updateFromSubscription,
  type StripeEvent,
} from "../../../src/lib/stripe/webhook"

const NOW = 1_800_000_000
const payload = JSON.stringify({ id: "evt_1", type: "customer.subscription.updated", data: { object: { id: "sub_1" } } })

describe("constructEvent", () => {
  it("accepts a correctly signed payload and returns the event", async () => {
    const header = await signPayload(payload, "whsec_a", NOW)
    await expect(constructEvent(payload, header, ["whsec_a"], { now: NOW })).resolves.toMatchObject({ id: "evt_1" })
  })

  it("accepts any of several secrets while rotating, and any of several signatures", async () => {
    const header = await signPayload(payload, "whsec_new", NOW)
    await expect(constructEvent(payload, header, ["whsec_old", "whsec_new"], { now: NOW })).resolves.toBeTruthy()
    const both = `${header}, v1=${"0".repeat(64)}, v0=ignored`
    await expect(constructEvent(payload, both, ["whsec_new"], { now: NOW })).resolves.toBeTruthy()
  })

  it.each([
    ["no header", null, ["s"], "Missing Stripe-Signature header"],
    ["no secret", "t=1,v1=x", [], "No webhook signing secret configured"],
    ["no timestamp", "v1=abc", ["s"], "Malformed"],
    ["no signature", `t=${NOW}`, ["s"], "Malformed"],
  ])("rejects %s", async (_label, header, secrets, message) => {
    await expect(constructEvent(payload, header, secrets, { now: NOW })).rejects.toThrow(message)
  })

  it("rejects a stale or future timestamp outside the tolerance", async () => {
    const old = await signPayload(payload, "s", NOW - 301)
    await expect(constructEvent(payload, old, ["s"], { now: NOW })).rejects.toThrow("tolerance")
    await expect(constructEvent(payload, old, ["s"], { now: NOW, toleranceSeconds: 600 })).resolves.toBeTruthy()
    const future = await signPayload(payload, "s", NOW + 400)
    await expect(constructEvent(payload, future, ["s"], { now: NOW })).rejects.toBeInstanceOf(StripeSignatureError)
  })

  it("rejects a tampered body, a wrong secret and a truncated signature", async () => {
    const header = await signPayload(payload, "s", NOW)
    await expect(constructEvent(payload + " ", header, ["s"], { now: NOW })).rejects.toThrow("No matching Stripe signature")
    await expect(constructEvent(payload, header, ["other"], { now: NOW })).rejects.toThrow("No matching")
    await expect(constructEvent(payload, header.slice(0, -2), ["s"], { now: NOW })).rejects.toThrow("No matching")
  })

  it("signs with the current time by default", async () => {
    const header = await signPayload(payload, "s")
    await expect(constructEvent(payload, header, ["s"])).resolves.toBeTruthy()
  })
})

describe("parseSecrets", () => {
  it("splits, trims and drops blanks", () => {
    expect(parseSecrets(" a, ,b ,")).toEqual(["a", "b"])
    expect(parseSecrets(undefined)).toEqual([])
  })
})

describe("updateFromSubscription", () => {
  const plan = PLANS[0]

  it("reads the price, plan and period end from the subscription item", () => {
    expect(
      updateFromSubscription({
        id: "sub_1",
        customer: { id: "cus_1" },
        status: "active",
        items: { data: [{ price: { id: plan.priceId }, current_period_end: NOW }] },
      }),
    ).toEqual({
      subscriptionId: "sub_1",
      customerId: "cus_1",
      priceId: plan.priceId,
      plan: plan.id,
      status: "active",
      currentPeriodEnd: new Date(NOW * 1000),
      cancelAtPeriodEnd: false,
    })
  })

  it("falls back to the legacy plan and subscription-level period end", () => {
    const update = updateFromSubscription({
      id: "sub_2",
      customer: "cus_2",
      status: "canceled",
      current_period_end: NOW,
      cancel_at: NOW,
      items: { data: [{ plan: { id: "price_unknown" } }] },
    })
    expect(update).toMatchObject({ customerId: "cus_2", priceId: "price_unknown", plan: "unknown", cancelAtPeriodEnd: true })
    expect(update.currentPeriodEnd).toEqual(new Date(NOW * 1000))
  })

  it("leaves price and period unset when the subscription has neither", () => {
    const update = updateFromSubscription({ id: "sub_3", customer: 42, cancel_at_period_end: true })
    expect(update).toEqual({
      subscriptionId: "sub_3",
      customerId: undefined,
      status: undefined,
      currentPeriodEnd: null,
      cancelAtPeriodEnd: true,
    })
  })
})

describe("subscriptionUpdateForEvent", () => {
  const event = (type: string, object: Record<string, unknown>): StripeEvent => ({ id: "evt", type, data: { object } })

  it("links a completed subscription checkout to its user, customer and email", () => {
    expect(
      subscriptionUpdateForEvent(
        event("checkout.session.completed", {
          mode: "subscription",
          subscription: "sub_1",
          client_reference_id: 7,
          customer: { id: "cus_1" },
          customer_details: { email: "a@example.com" },
        }),
      ),
    ).toEqual({ subscriptionId: "sub_1", userId: "7", customerId: "cus_1", email: "a@example.com" })

    expect(
      subscriptionUpdateForEvent(
        event("checkout.session.async_payment_succeeded", {
          mode: "subscription",
          subscription: { id: "sub_2" },
          customer_email: "b@example.com",
        }),
      ),
    ).toEqual({ subscriptionId: "sub_2", customerId: undefined, email: "b@example.com" })
  })

  it("ignores one-off payment checkouts and checkouts without a subscription", () => {
    expect(subscriptionUpdateForEvent(event("checkout.session.completed", { mode: "payment", subscription: "sub" }))).toBeNull()
    expect(subscriptionUpdateForEvent(event("checkout.session.completed", { mode: "subscription" }))).toBeNull()
  })

  it.each([
    "customer.subscription.created",
    "customer.subscription.updated",
    "customer.subscription.deleted",
    "customer.subscription.paused",
    "customer.subscription.resumed",
  ])("reads the subscription on %s", (type) => {
    expect(subscriptionUpdateForEvent(event(type, { id: "sub_9", status: "paused" }))).toMatchObject({
      subscriptionId: "sub_9",
      status: "paused",
    })
  })

  it("ignores unrelated events and events without an object", () => {
    expect(subscriptionUpdateForEvent(event("invoice.paid", {}))).toBeNull()
    expect(subscriptionUpdateForEvent({ id: "e", type: "checkout.session.completed" } as unknown as StripeEvent)).toBeNull()
  })
})
