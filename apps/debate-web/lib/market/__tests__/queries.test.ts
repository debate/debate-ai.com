/**
 * @fileoverview The file-market queries against a real SQLite database built
 * from the app schema: top-up credits, listings and purchases, and that the
 * migration `debate-file-market` ships matches `schema.ts`.
 */

import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { eq } from "drizzle-orm";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  creditTopUp,
  ensureWallet,
  getListing,
  getListingRow,
  listListings,
  PurchaseRefused,
  purchaseListing,
  stopListing,
  upsertListing,
} from "@/lib/market/queries";
import * as schema from "@/lib/database/schema";
import { documents, fileListings, filePurchases, wallets, walletTransactions } from "@/lib/database/schema";
import { applySchema, schemaStatements } from "@/lib/database/__tests__/schema-sql";
import { splitStatements } from "@/lib/database/migration-sql";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../../../..");
const MIGRATION = join(REPO_ROOT, "packages/debate-file-market/migrations/0001_file_market.sql");
const MARKET_TABLES = /^CREATE (?:UNIQUE )?(?:TABLE|INDEX) [^\n]*`(wallets|wallet_transactions|file_listings|file_purchases)`/;

let directory: string;
let client: ReturnType<typeof createClient>;
let db: ReturnType<typeof drizzle<typeof schema>>;
const q = () => db as never;

async function addUser(id: string): Promise<void> {
  await client.execute({
    sql: "INSERT INTO user (id, name, email, created_at, updated_at) VALUES (?, ?, ?, unixepoch(), unixepoch())",
    args: [id, id.toUpperCase(), `${id}@example.test`],
  });
}

async function addDocument(userId: string, content = "<h1>Aff</h1><h4>Tag</h4><p>Card text</p>") {
  const [row] = await db.insert(documents).values({ title: "Aff file", content, userId }).returning();
  return row.id;
}

async function balance(userId: string) {
  return (await ensureWallet(q(), userId)).balanceCents;
}

beforeAll(async () => {
  directory = mkdtempSync(join(tmpdir(), "market-queries-"));
  client = createClient({ url: `file:${join(directory, "db.sqlite")}` });
  db = drizzle(client, { schema });
  await applySchema(client);
});

afterAll(() => {
  client.close();
  rmSync(directory, { recursive: true, force: true });
});

beforeEach(async () => {
  await db.delete(filePurchases);
  await db.delete(fileListings);
  await db.delete(walletTransactions);
  await db.delete(wallets);
  await db.delete(documents);
  await client.execute("DELETE FROM user");
  await addUser("seller");
  await addUser("buyer");
});

describe("the migration shipped in debate-file-market", () => {
  it("creates exactly what schema.ts declares for the market tables", async () => {
    const fromSchema = (await schemaStatements())
      .filter((statement) => MARKET_TABLES.test(statement))
      .map((statement) =>
        statement.replace(/^CREATE (UNIQUE INDEX|TABLE|INDEX) /, "CREATE $1 IF NOT EXISTS ").trim().replace(/;$/, ""),
      );
    expect(fromSchema.length).toBeGreaterThan(0);
    // Compared as sets: drizzle-kit's table order isn't stable between runs,
    // and SQLite doesn't need a foreign key's target to exist at CREATE time.
    expect(splitStatements(readFileSync(MIGRATION, "utf8")).sort()).toEqual(fromSchema.sort());
  });
});

describe("creditTopUp", () => {
  it("credits a Stripe session once, however often it is delivered", async () => {
    const topUp = { sessionId: "cs_1", userId: "buyer", topUp: "usd-10" as const, amountCents: 1000 };
    expect(await creditTopUp(q(), topUp)).toBe(true);
    expect(await creditTopUp(q(), topUp)).toBe(false);
    expect(await balance("buyer")).toBe(1000);
    await creditTopUp(q(), { ...topUp, sessionId: "cs_2", amountCents: 2000 });
    expect(await balance("buyer")).toBe(3000);
  });

  it("ignores a session whose user id names no account", async () => {
    expect(await creditTopUp(q(), { sessionId: "cs_3", userId: "ghost", topUp: "usd-10", amountCents: 1000 })).toBe(false);
  });
});

describe("selling and buying", () => {
  it("shows the preview to anyone and the cards only to owners", async () => {
    const documentId = await addDocument("seller");
    const id = await upsertListing(q(), {
      sellerId: "seller",
      documentId,
      priceCents: 500,
      outline: [{ level: 1, text: "Aff" }],
    });

    const asStranger = await getListing(q(), id, null);
    expect(asStranger).toMatchObject({ title: "Aff file", priceCents: 500, owned: false, outline: [{ level: 1, text: "Aff" }] });
    expect(asStranger?.content).toBeUndefined();
    expect((await getListing(q(), id, "seller"))?.content?.content).toContain("Card text");
    expect((await listListings(q())).map((listing) => listing.id)).toEqual([id]);
  });

  it("refuses to list someone else's file or a folder", async () => {
    const documentId = await addDocument("seller");
    await expect(upsertListing(q(), { sellerId: "buyer", documentId, priceCents: 500, outline: [] })).rejects.toBeInstanceOf(
      PurchaseRefused,
    );
    const [folder] = await db.insert(documents).values({ title: "F", userId: "seller", isFolder: true }).returning();
    await expect(
      upsertListing(q(), { sellerId: "seller", documentId: folder.id, priceCents: 500, outline: [] }),
    ).rejects.toThrow(/Folders/);
  });

  it("relisting reprices the same listing", async () => {
    const documentId = await addDocument("seller");
    const first = await upsertListing(q(), { sellerId: "seller", documentId, priceCents: 500, outline: [] });
    const second = await upsertListing(q(), { sellerId: "seller", documentId, priceCents: 900, outline: [] });
    expect(second).toBe(first);
    expect((await getListingRow(q(), first))?.priceCents).toBe(900);
  });

  it("moves the price from buyer to seller and saves the buyer a copy", async () => {
    const documentId = await addDocument("seller");
    const id = await upsertListing(q(), { sellerId: "seller", documentId, priceCents: 700, outline: [] });
    await creditTopUp(q(), { sessionId: "cs_1", userId: "buyer", topUp: "usd-10", amountCents: 1000 });

    const copyId = await purchaseListing(q(), (await getListingRow(q(), id))!, "buyer");

    expect(await balance("buyer")).toBe(300);
    expect(await balance("seller")).toBe(700);
    const [copy] = await db.select().from(documents).where(eq(documents.id, copyId));
    expect(copy).toMatchObject({ userId: "buyer", title: "Aff file" });
    expect(copy.content).toContain("Card text");
    expect((await getListing(q(), id, "buyer"))?.owned).toBe(true);
    expect((await getListingRow(q(), id))?.sales).toBe(1);

    await expect(purchaseListing(q(), (await getListingRow(q(), id))!, "buyer")).rejects.toThrow(/already own/);
    expect(await balance("buyer")).toBe(300);
  });

  it("refuses a buyer whose wallet doesn't cover the price, and charges nothing", async () => {
    const documentId = await addDocument("seller");
    const id = await upsertListing(q(), { sellerId: "seller", documentId, priceCents: 1500, outline: [] });
    await creditTopUp(q(), { sessionId: "cs_1", userId: "buyer", topUp: "usd-10", amountCents: 1000 });

    await expect(purchaseListing(q(), (await getListingRow(q(), id))!, "buyer")).rejects.toMatchObject({ status: 402 });
    expect(await balance("buyer")).toBe(1000);
    expect(await balance("seller")).toBe(0);
  });

  it("refuses the seller and a stopped listing; buyers keep access after a stop", async () => {
    const documentId = await addDocument("seller");
    const id = await upsertListing(q(), { sellerId: "seller", documentId, priceCents: 500, outline: [] });
    await expect(purchaseListing(q(), (await getListingRow(q(), id))!, "seller")).rejects.toMatchObject({ status: 409 });

    await creditTopUp(q(), { sessionId: "cs_1", userId: "buyer", topUp: "usd-10", amountCents: 1000 });
    await purchaseListing(q(), (await getListingRow(q(), id))!, "buyer");
    expect(await stopListing(q(), id, "buyer")).toBe(false);
    expect(await stopListing(q(), id, "seller")).toBe(true);

    expect(await getListing(q(), id, null)).toBeNull();
    expect((await getListing(q(), id, "buyer"))?.content).toBeDefined();
    expect(await listListings(q())).toEqual([]);
    await addUser("late");
    await expect(purchaseListing(q(), (await getListingRow(q(), id))!, "late")).rejects.toMatchObject({ status: 410 });
  });
});
