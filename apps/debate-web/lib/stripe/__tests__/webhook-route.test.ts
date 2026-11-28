/**
 * @fileoverview `POST /api/stripe/webhook` end to end against a real SQLite
 * database: only a correctly signed payload is read, a paid top-up credits the
 * wallet exactly once per Checkout Session, subscription events upsert the
 * subscription row (preferring Stripe's live copy when a secret key is set),
 * and everything else is acknowledged without a write.
 */

import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { freshSchemaDb } from "@/lib/database/__tests__/schema-sql";
import * as schema from "@/lib/database/schema";
import { PLANS } from "@debate-ai/webview/lib/stripe/plans";
import { signPayload } from "@debate-ai/webview/lib/stripe/webhook";

type Db = Awaited<ReturnType<typeof freshSchemaDb>>;

let db: Db;
const env: Record<string, string | undefined> = {};

vi.mock("@/lib/database/context", () => ({ getDBFromContext: async () => db, getCloudflareContext: () => undefined }));
vi.mock("@/lib/env", () => ({ getEnv: (key: string) => env[key] }));

const { POST } = await import("@/app/api/stripe/webhook/route");

const SECRET = "whsec_route_test";
const PRO = PLANS.find((plan) => plan.id === "pro-vip")!;

async function deliver(event: unknown, { secret = SECRET, header }: { secret?: string; header?: string | null } = {}) {
  const payload = typeof event === "string" ? event : JSON.stringify(event);
  const signature = header === undefined ? await signPayload(payload, secret) : header;
  return POST(
    new NextRequest("https://debate-ai.com/api/stripe/webhook", {
      method: "POST",
      body: payload,
      headers: signature ? { "stripe-signature": signature } : {},
    }),
  );
}

const topUpEvent = (sessionId = "cs_1", extra: Record<string, unknown> = {}) => ({
  id: "evt_topup",
  type: "checkout.session.completed",
  data: {
    object: {
      id: sessionId,
      mode: "payment",
      payment_status: "paid",
      currency: "usd",
      amount_total: 1000,
      payment_link: "plink_1",
      client_reference_id: "alex",
      ...extra,
    },
  },
});

const subscriptionEvent = (status = "active", type = "customer.subscription.updated") => ({
  id: "evt_sub",
  type,
  data: {
    object: {
      id: "sub_1",
      customer: "cus_1",
      status,
      cancel_at_period_end: false,
      items: { data: [{ price: { id: PRO.priceId }, current_period_end: 1_900_000_000 }] },
    },
  },
});

beforeEach(async () => {
  db = await freshSchemaDb();
  for (const key of Object.keys(env)) delete env[key];
  env.STRIPE_WEBHOOK_SECRET = SECRET;
  vi.unstubAllGlobals();
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
  const now = new Date();
  await db.insert(schema.user).values({ id: "alex", name: "Alex", email: "alex@example.com", createdAt: now, updatedAt: now });
});

const balance = async () => (await db.select().from(schema.wallets).where(eq(schema.wallets.userId, "alex")))[0]?.balanceCents ?? 0;

describe("signature verification", () => {
  it("answers 400 to a missing, wrong or unconfigured signature, and to a body that is not JSON", async () => {
    expect((await deliver(topUpEvent(), { header: null })).status).toBe(400);
    expect((await deliver(topUpEvent(), { secret: "whsec_other" })).status).toBe(400);
    expect((await deliver("not json")).status).toBe(400);

    delete env.STRIPE_WEBHOOK_SECRET;
    expect((await deliver(topUpEvent())).status).toBe(400);
    expect(await balance()).toBe(0);
  });

  it("accepts either secret while one is being rotated", async () => {
    env.STRIPE_WEBHOOK_SECRET = `whsec_new, ${SECRET}`;
    const res = await deliver({ id: "evt_x", type: "invoice.paid", data: { object: {} } });
    expect(await res.json()).toEqual({ received: true, ignored: "invoice.paid" });
  });
});

describe("wallet top-ups", () => {
  it("credits a paid top-up once per Checkout Session, even when Stripe redelivers it", async () => {
    const first = await deliver(topUpEvent("cs_1"));
    expect(await first.json()).toEqual({ received: true, topUp: "cs_1", credited: true });
    expect(await balance()).toBe(1000);

    const again = await deliver(topUpEvent("cs_1"));
    expect(await again.json()).toMatchObject({ credited: false });
    expect(await balance()).toBe(1000);

    await deliver(topUpEvent("cs_2"));
    expect(await balance()).toBe(2000);
  });

  it("does not credit a session for a user that has no account", async () => {
    const res = await deliver(topUpEvent("cs_9", { client_reference_id: "ghost" }));
    expect(await res.json()).toMatchObject({ credited: false });
    expect(await db.select().from(schema.walletTransactions)).toEqual([]);
  });

  it("ignores an unpaid session until its async payment succeeds", async () => {
    const unpaid = await deliver(topUpEvent("cs_3", { payment_status: "unpaid" }));
    expect(await unpaid.json()).toMatchObject({ ignored: "checkout.session.completed" });
    expect(await balance()).toBe(0);

    const succeeded = { ...topUpEvent("cs_3"), type: "checkout.session.async_payment_succeeded" };
    expect(await (await deliver(succeeded)).json()).toMatchObject({ credited: true });
    expect(await balance()).toBe(1000);
  });

  it("answers 500 so Stripe retries when the wallet write fails", async () => {
    db = { select: () => { throw new Error("d1 down"); } } as unknown as Db;
    expect((await deliver(topUpEvent())).status).toBe(500);
  });
});

describe("subscription events", () => {
  const subscriptions = () => db.select().from(schema.stripeSubscriptions);

  it("stores the subscription an update describes, mapped to its plan", async () => {
    const res = await deliver(subscriptionEvent("trialing", "customer.subscription.created"));
    expect(await res.json()).toEqual({ received: true, subscription: "sub_1" });
    const [row] = await subscriptions();
    expect(row).toMatchObject({ subscriptionId: "sub_1", customerId: "cus_1", priceId: PRO.priceId, plan: PRO.id, status: "trialing" });
    expect(row.currentPeriodEnd?.getTime()).toBe(1_900_000_000 * 1000);

    await deliver(subscriptionEvent("canceled", "customer.subscription.deleted"));
    const rows = await subscriptions();
    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe("canceled");
  });

  it("attributes a checkout to the account that owns its email when there is no client reference", async () => {
    await deliver({
      id: "evt_checkout",
      type: "checkout.session.completed",
      data: { object: { id: "cs_sub", mode: "subscription", subscription: "sub_2", customer: "cus_2", customer_details: { email: "Alex@Example.com" } } },
    });
    expect((await subscriptions())[0]).toMatchObject({ subscriptionId: "sub_2", userId: "alex" });
  });

  it("lets Stripe's live copy of the subscription win over the event's stale snapshot", async () => {
    env.STRIPE_SECRET_KEY = "sk_test";
    const requested: string[] = [];
    vi.stubGlobal("fetch", async (url: string, init: RequestInit) => {
      requested.push(`${url} ${(init.headers as Record<string, string>).Authorization}`);
      return new Response(JSON.stringify({ ...subscriptionEvent("past_due").data.object }), { status: 200 });
    });
    await deliver(subscriptionEvent("active"));
    expect(requested).toEqual(["https://api.stripe.com/v1/subscriptions/sub_1 Bearer sk_test"]);
    expect((await subscriptions())[0].status).toBe("past_due");
  });

  it("falls back to the event when the live lookup fails", async () => {
    env.STRIPE_SECRET_KEY = "sk_test";
    vi.stubGlobal("fetch", async () => new Response("nope", { status: 500 }));
    await deliver(subscriptionEvent("active"));
    expect((await subscriptions())[0].status).toBe("active");
  });

  it("answers 500 so Stripe retries when the subscription write fails", async () => {
    db = { select: () => { throw new Error("d1 down"); }, insert: () => { throw new Error("d1 down"); } } as unknown as Db;
    expect((await deliver(subscriptionEvent())).status).toBe(500);
  });

  it("acknowledges one-off checkouts and unrelated events without writing", async () => {
    const oneOff = await deliver({
      id: "evt_oneoff",
      type: "checkout.session.completed",
      data: { object: { id: "cs_oneoff", mode: "payment", payment_status: "paid", amount_total: 4200 } },
    });
    expect(await oneOff.json()).toEqual({ received: true, ignored: "checkout.session.completed" });
    expect(await subscriptions()).toEqual([]);
  });
});
