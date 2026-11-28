/**
 * @fileoverview The file-stats backfill against a real SQLite database: files
 * saved before the size columns existed get their quotes, blocks, pages and
 * characters counted (folders never do), owners' account names fill empty
 * authors without clobbering a real one, one unreadable row cannot spin the
 * loop, and a spent time budget stops the run cleanly for the next call.
 */

import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { freshSchemaDb } from "@/lib/database/__tests__/schema-sql";
import * as schema from "@/lib/database/schema";

type Db = Awaited<ReturnType<typeof freshSchemaDb>>;

let db: Db;
const poison = vi.hoisted(() => ({ marker: "POISON" }));

vi.mock("@/lib/file-stats/columns", async (importActual) => {
  const actual = await importActual<typeof import("@/lib/file-stats/columns")>();
  return {
    ...actual,
    fileStatColumns: async (content: string | null | undefined, format: string | null | undefined) => {
      if ((content ?? "").includes(poison.marker)) throw new Error("cannot count");
      return actual.fileStatColumns(content, format);
    },
  };
});

const { backfillFileStats, fileStatsRemaining } = await import("@/lib/file-stats/backfill");

const CARD_HTML =
  '<h3 class="pmd-block">Block</h3><div class="pmd-card"><h4>Tag</h4><p>Some evidence text here.</p></div><div class="pmd-card"><h4>Tag 2</h4><p>More.</p></div>';

async function addUser(id: string, name: string) {
  const now = new Date();
  await db.insert(schema.user).values({ id, name, email: `${id}@example.com`, createdAt: now, updatedAt: now });
}

async function addDocument(values: Partial<typeof schema.documents.$inferInsert>) {
  const [row] = await db.insert(schema.documents).values({ title: "Doc", ...values }).returning({ id: schema.documents.id });
  return row.id;
}

async function addStarter(values: Partial<typeof schema.topicStarterItems.$inferInsert>) {
  const [row] = await db.insert(schema.topicStarterItems).values({ title: "Starter", ...values }).returning({ id: schema.topicStarterItems.id });
  return row.id;
}

const documentRow = async (id: number) => (await db.select().from(schema.documents).where(eq(schema.documents.id, id)))[0];

beforeEach(async () => {
  db = await freshSchemaDb();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("backfillFileStats", () => {
  it("counts quotes, blocks, pages and characters for both file tables, and never touches folders", async () => {
    const doc = await addDocument({ content: CARD_HTML });
    const folder = await addDocument({ isFolder: true });
    const starter = await addStarter({ content: "<h3>One</h3><h4>Two</h4><h4>Three</h4>text" });

    const result = await backfillFileStats(db);
    expect(result).toMatchObject({
      topicStarters: { updated: 1, remaining: 0 },
      documents: { updated: 1, remaining: 0 },
      done: true,
    });

    expect(await documentRow(doc)).toMatchObject({ quoteCount: 2, blockCount: 1 });
    expect((await documentRow(doc)).charCount).toBeGreaterThan(20);
    expect((await documentRow(doc)).pageCount).toBeGreaterThanOrEqual(1);
    expect(await documentRow(folder)).toMatchObject({ quoteCount: null, charCount: null });

    const [starterRow] = await db.select().from(schema.topicStarterItems).where(eq(schema.topicStarterItems.id, starter));
    expect(starterRow).toMatchObject({ quoteCount: 2, blockCount: 1 });
  });

  it("counts an empty file as zero so it is not revisited, and leaves updatedAt alone", async () => {
    const stamp = new Date("2024-01-02T03:04:05Z");
    const id = await addDocument({ content: "", updatedAt: stamp });
    await backfillFileStats(db);
    const row = await documentRow(id);
    expect(row).toMatchObject({ quoteCount: 0, blockCount: 0, charCount: 0 });
    expect(row.updatedAt.getTime()).toBe(stamp.getTime());
    expect(await fileStatsRemaining(db)).toEqual({ topicStarters: 0, documents: 0 });
  });

  it("works through more rows than one batch", async () => {
    for (let n = 0; n < 45; n++) await addDocument({ content: `<p>file ${n}</p>` });
    const result = await backfillFileStats(db);
    expect(result.documents).toEqual({ updated: 45, remaining: 0 });
  });

  it("fills an empty author from the owner's name, but never replaces an author or fills an unowned file", async () => {
    await addUser("alex", "Alex Rivera");
    const blank = await addDocument({ userId: "alex", content: "x" });
    const named = await addDocument({ userId: "alex", content: "x", author: "Original Author" });
    const unowned = await addDocument({ userId: null, content: "x" });

    const result = await backfillFileStats(db);
    expect(result.authorsFilled).toBe(1);
    expect((await documentRow(blank)).author).toBe("Alex Rivera");
    expect((await documentRow(named)).author).toBe("Original Author");
    expect((await documentRow(unowned)).author).toBeNull();
  });

  it("skips a row it cannot count, reports it as remaining, and finishes the rest", async () => {
    const bad = await addDocument({ content: `<p>${poison.marker}</p>` });
    const good = await addDocument({ content: "<p>fine</p>" });

    const result = await backfillFileStats(db);
    expect(result.documents).toEqual({ updated: 1, remaining: 1 });
    expect(result.done).toBe(false);
    expect((await documentRow(good)).charCount).toBeGreaterThan(0);
    expect((await documentRow(bad)).charCount).toBeNull();
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining(`could not count row ${bad}`), expect.any(Error));
  });

  it("does no counting once its time budget is spent, and a later call picks up where it stopped", async () => {
    const id = await addDocument({ content: "<p>later</p>" });
    const spent = await backfillFileStats(db, { budgetMs: 0 });
    expect(spent).toMatchObject({ documents: { updated: 0, remaining: 1 }, done: false });
    expect((await documentRow(id)).charCount).toBeNull();

    const resumed = await backfillFileStats(db);
    expect(resumed).toMatchObject({ documents: { updated: 1, remaining: 0 }, done: true });
  });
});

describe("fileStatsRemaining", () => {
  it("counts files without stats in each table, ignoring folders", async () => {
    await addDocument({ content: "a" });
    await addDocument({ content: "b" });
    await addDocument({ isFolder: true });
    await addStarter({ content: "c" });
    expect(await fileStatsRemaining(db)).toEqual({ topicStarters: 1, documents: 2 });
  });
});
