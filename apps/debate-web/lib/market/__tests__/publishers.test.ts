/**
 * @fileoverview Research publishers against a real SQLite database built from
 * the app schema: the first-use DDL matches `schema.ts`, file details stay
 * the owner's, and subscribing moves money exactly once.
 */

import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { sql } from "drizzle-orm";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import * as schema from "@/lib/database/schema";
import {
  documentMetadata,
  documents,
  researchPublishers,
  researchPublisherSubscriptions,
  wallets,
  walletTransactions,
} from "@/lib/database/schema";
import { applySchema, schemaStatements } from "@/lib/database/__tests__/schema-sql";
import { splitStatements } from "@/lib/database/migration-sql";
import { ensureWallet, PurchaseRefused, credit } from "@/lib/market/queries";
import {
  PUBLISHER_TABLES_SQL,
  copyPublishedFile,
  createPublisher,
  ensurePublisherTables,
  getFileMetadata,
  publisherPage,
  saveFileMetadata,
  subscribe,
} from "@/lib/market/publishers";
import type { PublisherRequest } from "@debate-ai/file-market";

let directory: string;
let client: ReturnType<typeof createClient>;
let db: ReturnType<typeof drizzle<typeof schema>>;
const q = () => db as never;

const PUBLISHER_TABLES = /^CREATE (?:UNIQUE )?(?:TABLE|INDEX) [^\n]*`(research_publishers|research_publisher_subscriptions|document_metadata)`/;

const request = (overrides: Partial<PublisherRequest> = {}): PublisherRequest => ({
  name: "Westwood Lab",
  description: "",
  researchGroup: "Westwood HS",
  students: ["Ana", "Ben"],
  years: "2025–2026",
  website: "",
  priceCents: 500,
  ...overrides,
});

async function addUser(id: string): Promise<void> {
  await client.execute({
    sql: "INSERT INTO user (id, name, email, created_at, updated_at) VALUES (?, ?, ?, unixepoch(), unixepoch())",
    args: [id, id.toUpperCase(), `${id}@example.test`],
  });
}

async function addDocument(userId: string, title = "Aff file") {
  const [row] = await db.insert(documents).values({ title, content: "<h4>Tag</h4><p>Card</p>", userId }).returning();
  return row.id;
}

const balance = async (userId: string) => (await ensureWallet(q(), userId)).balanceCents;

beforeAll(async () => {
  directory = mkdtempSync(join(tmpdir(), "publishers-"));
  client = createClient({ url: `file:${join(directory, "db.sqlite")}` });
  db = drizzle(client, { schema });
  await applySchema(client);
});

afterAll(() => {
  client.close();
  rmSync(directory, { recursive: true, force: true });
});

beforeEach(async () => {
  await db.delete(documentMetadata);
  await db.delete(researchPublisherSubscriptions);
  await db.delete(researchPublishers);
  await db.delete(walletTransactions);
  await db.delete(wallets);
  await db.delete(documents);
  await client.execute("DELETE FROM user");
  await addUser("owner");
  await addUser("reader");
});

describe("the first-use DDL", () => {
  it("creates exactly what schema.ts declares", async () => {
    const fromSchema = (await schemaStatements())
      .filter((statement) => PUBLISHER_TABLES.test(statement))
      .map((statement) =>
        statement.replace(/^CREATE (UNIQUE INDEX|TABLE|INDEX) /, "CREATE $1 IF NOT EXISTS ").trim().replace(/;$/, ""),
      );
    expect(fromSchema).toHaveLength(PUBLISHER_TABLES_SQL.length);
    expect(splitStatements(PUBLISHER_TABLES_SQL.join(";\n")).sort()).toEqual(fromSchema.sort());
  });

  it("is safe to run on a database that already has the tables", async () => {
    await expect(ensurePublisherTables(q())).resolves.toBeUndefined();
    await db.run(sql.raw(PUBLISHER_TABLES_SQL[0]));
  });
});

describe("publishers", () => {
  it("gives each publisher its own slug", async () => {
    const first = await createPublisher(q(), "owner", request());
    const second = await createPublisher(q(), "reader", request());
    expect(first.slug).toBe("westwood-lab");
    expect(second.slug).toBe("westwood-lab-2");
  });
});

describe("file details", () => {
  it("saves and reads back a file's details and its publisher", async () => {
    const publisher = await createPublisher(q(), "owner", request());
    const documentId = await addDocument("owner");
    const saved = await saveFileMetadata(q(), documentId, "owner", {
      author: "Ana Ruiz",
      publisherId: publisher.id,
      researchGroup: "Westwood HS",
      students: ["Ana Ruiz", "Ben Lee"],
      years: "2025–2026",
      publishedOn: "2026-03-14",
      summary: "Space aff",
    });
    expect(saved.metadata).toMatchObject({ author: "Ana Ruiz", students: ["Ana Ruiz", "Ben Lee"], publishedOn: "2026-03-14" });
    expect(saved.publisher).toMatchObject({ slug: "westwood-lab", priceCents: 500 });
    expect((await getFileMetadata(q(), documentId, "owner")).ownPublishers.map((p) => p.id)).toEqual([publisher.id]);
  });

  it("won't publish under someone else's publisher", async () => {
    const publisher = await createPublisher(q(), "owner", request());
    const documentId = await addDocument("reader");
    await expect(
      saveFileMetadata(q(), documentId, "reader", {
        author: "",
        publisherId: publisher.id,
        researchGroup: "",
        students: [],
        years: "",
        publishedOn: "",
        summary: "",
      }),
    ).rejects.toBeInstanceOf(PurchaseRefused);
  });
});

describe("subscribing", () => {
  async function publishedSetup(priceCents = 500) {
    const publisher = await createPublisher(q(), "owner", request({ priceCents }));
    const documentId = await addDocument("owner");
    await saveFileMetadata(q(), documentId, "owner", {
      author: "Ana",
      publisherId: publisher.id,
      researchGroup: "",
      students: ["Ana"],
      years: "",
      publishedOn: "",
      summary: "",
    });
    return { publisher, documentId };
  }

  it("lists published files without their content", async () => {
    const { publisher } = await publishedSetup();
    const page = await publisherPage(q(), publisher, null);
    expect(page.files).toHaveLength(1);
    expect(page.files[0]).toMatchObject({ title: "Aff file", students: ["Ana"] });
    expect(page.files[0]).not.toHaveProperty("content");
    expect(page.publisher.students).toEqual(["Ana", "Ben"]);
  });

  it("charges the reader once and pays the owner", async () => {
    const { publisher } = await publishedSetup(500);
    await credit(q(), "reader", 1200);
    const subscription = await subscribe(q(), publisher, "reader");
    expect(subscription.active).toBe(true);
    expect(await balance("reader")).toBe(700);
    expect(await balance("owner")).toBe(500);
    await expect(subscribe(q(), publisher, "reader")).rejects.toMatchObject({ status: 409 });
    expect(await balance("reader")).toBe(700);
    const page = await publisherPage(q(), publisher, "reader");
    expect(page.subscription?.active).toBe(true);
    expect(page.publisher.subscribers).toBe(1);
  });

  it("refuses when the wallet is short and leaves no subscription behind", async () => {
    const { publisher } = await publishedSetup(500);
    await expect(subscribe(q(), publisher, "reader")).rejects.toMatchObject({ status: 402 });
    expect((await publisherPage(q(), publisher, "reader")).subscription).toBeNull();
  });

  it("renews a lapsed month, and is free for a free publisher", async () => {
    const { publisher } = await publishedSetup(0);
    await subscribe(q(), publisher, "reader");
    expect(await balance("reader")).toBe(0);
    await db.update(researchPublisherSubscriptions).set({ expiresAt: new Date(Date.now() - 1000) });
    expect((await publisherPage(q(), publisher, "reader")).subscription?.active).toBe(false);
    await expect(subscribe(q(), publisher, "reader")).resolves.toMatchObject({ active: true });
  });

  it("won't let the owner subscribe to themselves", async () => {
    const { publisher } = await publishedSetup();
    await expect(subscribe(q(), publisher, "owner")).rejects.toMatchObject({ status: 409 });
  });

  it("lets only subscribers and the owner save a copy", async () => {
    const { publisher, documentId } = await publishedSetup(0);
    await expect(copyPublishedFile(q(), publisher, documentId, "reader")).rejects.toMatchObject({ status: 402 });
    await subscribe(q(), publisher, "reader");
    const copy = await copyPublishedFile(q(), publisher, documentId, "reader");
    const [row] = await db.select().from(documents).where(sql`${documents.id} = ${copy}`);
    expect(row).toMatchObject({ userId: "reader", title: "Aff file", author: "Ana" });
    expect(await copyPublishedFile(q(), publisher, documentId, "owner")).toBeGreaterThan(0);
  });

  it("won't copy a file that isn't published under the publisher", async () => {
    const { publisher } = await publishedSetup(0);
    const other = await addDocument("owner", "Private");
    await expect(copyPublishedFile(q(), publisher, other, "owner")).rejects.toMatchObject({ status: 404 });
  });
});
