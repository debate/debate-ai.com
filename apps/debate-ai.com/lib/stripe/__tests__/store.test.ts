/**
 * @fileoverview Runs the webhook's persistence against a real in-memory SQLite
 * database built from the actual `0052_stripe_subscriptions.sql` migration,
 * including Stripe's out-of-order delivery (subscription event before the
 * checkout that names the user).
 */
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { createClient } from "@libsql/client"
import { drizzle } from "drizzle-orm/libsql"
import { beforeEach, describe, expect, it } from "vitest"
import * as schema from "../../database/schema"
import { PLANS } from "../plans"
import { getActiveSubscription, saveSubscriptionUpdate } from "../store"
import { subscriptionUpdateForEvent } from "../webhook"

const MIGRATION = readFileSync(
  join(import.meta.dirname, "../../../drizzle/0052_stripe_subscriptions.sql"),
  "utf8",
)
const TEAM = PLANS.find((p) => p.id === "research-team")!

async function freshDb() {
  const client = createClient({ url: ":memory:" })
  await client.execute(`CREATE TABLE user (id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE)`)
  await client.execute(`INSERT INTO user (id, email) VALUES ('user_1', 'coach@example.com')`)
  for (const statement of MIGRATION.split("--> statement-breakpoint")) {
    await client.execute(statement)
  }
  return drizzle(client, { schema })
}

const subscriptionEvent = (status: string) =>
  subscriptionUpdateForEvent({
    id: `evt_${status}`,
    type: status === "canceled" ? "customer.subscription.deleted" : "customer.subscription.updated",
    data: {
      object: {
        id: "sub_1",
        customer: "cus_1",
        status,
        cancel_at_period_end: false,
        items: { data: [{ price: { id: TEAM.priceId }, current_period_end: 1_790_000_000 }] },
      },
    },
  })!

const checkoutEvent = (extra: Record<string, unknown>) =>
  subscriptionUpdateForEvent({
    id: "evt_checkout",
    type: "checkout.session.completed",
    data: { object: { mode: "subscription", subscription: "sub_1", customer: "cus_1", ...extra } },
  })!

describe("stripe subscription store", () => {
  let db: Awaited<ReturnType<typeof freshDb>>
  beforeEach(async () => {
    db = await freshDb()
  })

  it("links a subscription that arrived before its checkout", async () => {
    await saveSubscriptionUpdate(db, subscriptionEvent("active"))
    expect(await getActiveSubscription(db, "user_1")).toBeNull()

    await saveSubscriptionUpdate(db, checkoutEvent({ client_reference_id: "user_1" }))
    const row = await getActiveSubscription(db, "user_1")
    // The checkout's partial update must not wipe the plan/status set earlier.
    expect(row).toMatchObject({ subscriptionId: "sub_1", plan: "research-team", status: "active", customerId: "cus_1" })
    expect(row.currentPeriodEnd).toEqual(new Date(1_790_000_000 * 1000))
  })

  it("attributes a checkout without client_reference_id by email", async () => {
    await saveSubscriptionUpdate(db, checkoutEvent({ customer_details: { email: "Coach@Example.com" } }))
    await saveSubscriptionUpdate(db, subscriptionEvent("trialing"))
    expect(await getActiveSubscription(db, "user_1")).toMatchObject({ status: "trialing" })
  })

  it("stops granting access once the subscription is canceled", async () => {
    await saveSubscriptionUpdate(db, checkoutEvent({ client_reference_id: "user_1" }))
    await saveSubscriptionUpdate(db, subscriptionEvent("active"))
    await saveSubscriptionUpdate(db, subscriptionEvent("canceled"))
    expect(await getActiveSubscription(db, "user_1")).toBeNull()
  })
})
