/**
 * @fileoverview The admin Buyers report against a real in-memory SQLite
 * database: subscriptions, wallet top-ups and file purchases merge into one
 * row per account, and missing payment tables read as empty.
 */
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { describe, expect, it } from "vitest";
import * as schema from "../../database/schema";
import { applySchema } from "../../database/__tests__/schema-sql";
import { fileListings, filePurchases, stripeSubscriptions, user, walletTransactions } from "../../database/schema";
import { loadBuyers } from "../buyers";

async function freshDb() {
  const client = createClient({ url: ":memory:" });
  await applySchema(client);
  return { client, db: drizzle(client, { schema }) };
}

function userRow(id: string) {
  return {
    id,
    name: `User ${id}`,
    email: `${id}@example.com`,
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
  };
}

describe("loadBuyers", () => {
  it("merges subscriptions, top-ups and file purchases per account", async () => {
    const { db } = await freshDb();
    await db.insert(user).values([userRow("a"), userRow("b"), userRow("c"), userRow("seller")]);
    await db.insert(stripeSubscriptions).values([
      {
        subscriptionId: "sub_old",
        userId: "a",
        plan: "pro-vip",
        status: "canceled",
        createdAt: new Date("2026-02-01"),
        updatedAt: new Date("2026-02-01"),
      },
      {
        subscriptionId: "sub_new",
        userId: "a",
        plan: "research-team",
        status: "active",
        currentPeriodEnd: new Date("2026-12-01"),
        createdAt: new Date("2026-03-01"),
        updatedAt: new Date("2026-03-01"),
      },
      { subscriptionId: "sub_orphan", email: "stranger@example.com", plan: "pro-vip", status: "active", createdAt: new Date("2026-01-15") },
    ]);
    await db.insert(walletTransactions).values([
      { id: "t1", userId: "b", kind: "topup", amountCents: 1000, ref: "stripe:1", createdAt: new Date("2026-04-01") },
      { id: "t2", userId: "b", kind: "topup", amountCents: 2000, ref: "stripe:2", createdAt: new Date("2026-05-01") },
      { id: "t3", userId: "b", kind: "purchase", amountCents: -300, ref: "purchase:l1:b", createdAt: new Date("2026-05-02") },
      { id: "t4", userId: "seller", kind: "sale", amountCents: 300, ref: "sale:l1:b", createdAt: new Date("2026-05-02") },
    ]);
    await db.insert(fileListings).values({ id: "l1", sellerId: "seller", title: "Aff file", priceCents: 300 });
    await db.insert(filePurchases).values({ listingId: "l1", buyerId: "b", priceCents: 300, createdAt: new Date("2026-05-02") });

    const { buyers, totals } = await loadBuyers(db as any);

    expect(buyers.map((b) => b.email)).toEqual(["a@example.com", "stranger@example.com", "b@example.com"]);
    const a = buyers[0];
    expect(a).toMatchObject({ userId: "a", name: "User a", plan: "Debate AI Research Team", status: "active", activeSubscription: true });
    expect(a.currentPeriodEnd).toBe("2026-12-01T00:00:00.000Z");
    expect(buyers[1]).toMatchObject({ userId: null, plan: "Debate AI Pro VIP" });
    expect(buyers[2]).toMatchObject({ userId: "b", plan: null, topUpCents: 3000, filesBought: 1, fileSpendCents: 300 });
    expect(buyers[2].lastPurchaseAt).toBe("2026-05-02T00:00:00.000Z");
    // A seller's sale credit isn't a purchase.
    expect(buyers.some((b) => b.userId === "seller" || b.userId === "c")).toBe(false);

    expect(totals).toEqual({
      buyers: 3,
      activeSubscribers: 2,
      monthlyRecurringCents: 4900 + 500,
      topUpCents: 3000,
      filesSold: 1,
      fileSalesCents: 300,
    });
  });

  it("treats missing payment tables as no purchases", async () => {
    const { client, db } = await freshDb();
    await client.execute("DROP TABLE file_purchases");
    await client.execute("DROP TABLE wallet_transactions");
    await client.execute("DROP TABLE stripe_subscriptions");
    const report = await loadBuyers(db as any);
    expect(report.buyers).toEqual([]);
    expect(report.totals.buyers).toBe(0);
  });
});
