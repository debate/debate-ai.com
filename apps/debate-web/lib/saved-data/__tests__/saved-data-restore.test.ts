/** @fileoverview Restoring saved work from an export file, against in-memory SQLite. */
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { describe, expect, it } from "vitest";
import * as schema from "../../database/schema";
import { applySchema } from "../../database/__tests__/schema-sql";
import { documents, savedFlows, savedRounds, user } from "../../database/schema";
import { exportAllOwnSavedData, exportOwnSavedItem, listOwnSavedItems } from "../saved-data-items";
import { MAX_RESTORE_ITEMS, parseRestoreFile, restoreOwnSavedData } from "../saved-data-restore";

async function freshDb() {
  const client = createClient({ url: ":memory:" });
  await applySchema(client);
  const db = drizzle(client, { schema });
  const row = (id: string) => ({ id, name: id, email: `${id}@example.com`, createdAt: new Date("2024-09-01"), updatedAt: new Date("2024-09-01") });
  await db.insert(user).values([row("a"), row("b")]);
  return db;
}

const flow = (id: number, content = "1AC") => ({ id, content, level: 0, columns: ["1AC", "1NC"], invert: false, focus: false, index: 0, lastFocus: [], children: [] });

const round = (id: number, flowIds: number[] = []) => ({
  id,
  tournamentName: "TOC",
  roundLevel: "Finals",
  debaters: { aff: ["A", "B"], neg: ["C", "D"] },
  judges: ["J"],
  flowIds,
  timestamp: 1,
  status: "completed",
});

const NOW = new Date("2026-11-11T00:00:00Z");

describe("parseRestoreFile", () => {
  it("reads a single-item export", () => {
    const parsed = parseRestoreFile({ kind: "flows", id: 3, title: "1AC", data: flow(3) });
    expect(parsed).toMatchObject({ ok: true, entries: [{ kind: "flows", doc: { id: 3 } }] });
  });

  it("reads every kind of a bulk archive and ignores non-object entries", () => {
    const parsed = parseRestoreFile({ exportedAt: "2026-01-01", docs: [{ id: 1 }, "junk"], flows: [{ id: 2 }], rounds: [], practiceRounds: [{ id: 4 }] });
    expect(parsed.ok && parsed.entries.map((e) => e.kind)).toEqual(["docs", "flows", "practiceRounds"]);
  });

  it("rejects files that aren't exports, are malformed, empty or too big", () => {
    expect(parseRestoreFile(null)).toMatchObject({ ok: false });
    expect(parseRestoreFile([1, 2])).toMatchObject({ ok: false });
    expect(parseRestoreFile({ kind: "speeches", id: 1 })).toMatchObject({ ok: false });
    expect(parseRestoreFile({ exportedAt: "x", flows: "nope" })).toMatchObject({ ok: false, error: expect.stringContaining("flows") });
    expect(parseRestoreFile({ exportedAt: "x", docs: [] })).toMatchObject({ ok: false, error: expect.stringContaining("nothing") });
    const many = Array.from({ length: MAX_RESTORE_ITEMS + 1 }, (_, i) => ({ id: i }));
    expect(parseRestoreFile({ exportedAt: "x", docs: many })).toMatchObject({ ok: false, error: expect.stringContaining("smaller") });
  });
});

describe("restoreOwnSavedData", () => {
  it("brings back a deleted flow and round under their original ids", async () => {
    const db = await freshDb();
    const report = await restoreOwnSavedData(
      db,
      "a",
      [
        { kind: "flows", doc: { kind: "flows", id: 7, createdAt: "2025-01-02T00:00:00.000Z", data: flow(7, "Tariffs 1AC") } },
        { kind: "rounds", doc: { kind: "rounds", id: 9, data: round(9, [7]) } },
      ],
      { now: NOW },
    );
    expect(report).toEqual({ restored: { docs: 0, flows: 1, rounds: 1, practiceRounds: 0, wordCountRounds: 0, drills: 0 }, skipped: [] });
    const [savedFlow] = await db.select().from(savedFlows);
    expect(savedFlow).toMatchObject({ userId: "a", clientId: 7, label: "Tariffs 1AC", createdAt: new Date("2025-01-02T00:00:00Z"), updatedAt: NOW });
    expect(JSON.parse(savedFlow.data)).toEqual(flow(7, "Tariffs 1AC"));
    expect(await listOwnSavedItems(db, "a", "rounds")).toMatchObject([{ id: 9, href: "/debate?roundId=9" }]);
  });

  it("never overwrites an item still in the account, so restoring twice is harmless", async () => {
    const db = await freshDb();
    await db.insert(savedFlows).values({ userId: "a", clientId: 7, label: "Current", data: JSON.stringify(flow(7, "Current")) });
    const entries = [{ kind: "flows" as const, doc: { title: "Old", data: flow(7, "Old") } }];
    const report = await restoreOwnSavedData(db, "a", entries, { now: NOW });
    expect(report.skipped).toEqual([{ kind: "flows", title: "Old", reason: "Already in your account." }]);
    expect((await db.select().from(savedFlows))[0].label).toBe("Current");
  });

  it("restores into the caller's account even when another user has the same local id", async () => {
    const db = await freshDb();
    await db.insert(savedRounds).values({ userId: "b", clientId: 9, data: JSON.stringify(round(9)) });
    const report = await restoreOwnSavedData(db, "a", [{ kind: "rounds", doc: { data: round(9) } }], { now: NOW });
    expect(report.restored.rounds).toBe(1);
    expect(await listOwnSavedItems(db, "b", "rounds")).toHaveLength(1);
  });

  it("skips invalid flows and rounds with a reason instead of failing the whole file", async () => {
    const db = await freshDb();
    const report = await restoreOwnSavedData(
      db,
      "a",
      [
        { kind: "flows", doc: { title: "Broken", data: { id: 1 } } },
        { kind: "rounds", doc: { data: "not a round" } },
        { kind: "practiceRounds", doc: { title: "Vs bot" } },
        { kind: "flows", doc: { data: flow(2) } },
      ],
      { now: NOW },
    );
    expect(report.restored).toEqual({ docs: 0, flows: 1, rounds: 0, practiceRounds: 0, wordCountRounds: 0, drills: 0 });
    expect(report.skipped).toEqual([
      { kind: "flows", title: "Broken", reason: "Not a valid flow." },
      { kind: "rounds", title: "Untitled round", reason: "Not a valid round." },
      { kind: "practiceRounds", title: "Vs bot", reason: "Practice debates can't be restored yet." },
    ]);
  });

  it("reads word-count rounds and drill sets from a bulk archive but reports them as skipped", async () => {
    const parsed = parseRestoreFile({ exportedAt: "2026-01-01", wordCountRounds: [{ id: 1, title: "Word-count round · 2 speeches" }], drills: [{ id: 2 }] });
    expect(parsed.ok && parsed.entries.map((e) => e.kind)).toEqual(["wordCountRounds", "drills"]);
    const db = await freshDb();
    const report = await restoreOwnSavedData(db, "a", parsed.ok ? parsed.entries : [], { now: NOW });
    expect(report.restored).toEqual({ docs: 0, flows: 0, rounds: 0, practiceRounds: 0, wordCountRounds: 0, drills: 0 });
    expect(report.skipped).toEqual([
      { kind: "wordCountRounds", title: "Word-count round · 2 speeches", reason: "Word-count rounds can't be restored yet." },
      { kind: "drills", title: "Drill set", reason: "Drill sets can't be restored yet." },
    ]);
  });

  it("restores a deleted document as a new top-level row with a narrowed format", async () => {
    const db = await freshDb();
    const report = await restoreOwnSavedData(
      db,
      "a",
      [{ kind: "docs", doc: { kind: "docs", id: 4242, title: "  Aff file ", format: "exe", content: "<p>Card</p>", createdAt: "garbage" } }],
      { now: NOW, author: "Ada" },
    );
    expect(report.restored.docs).toBe(1);
    const [doc] = await db.select().from(documents);
    expect(doc).toMatchObject({ userId: "a", title: "Aff file", format: "html", content: "<p>Card</p>", parentId: null, isFolder: false, author: "Ada", createdAt: NOW });
    expect(doc.id).not.toBe(4242);
  });

  it("skips a document that is still the caller's, but restores one whose id belongs to someone else", async () => {
    const db = await freshDb();
    const [mine] = await db.insert(documents).values({ title: "Mine", userId: "a" }).returning();
    const [theirs] = await db.insert(documents).values({ title: "Theirs", userId: "b" }).returning();
    const report = await restoreOwnSavedData(
      db,
      "a",
      [
        { kind: "docs", doc: { id: mine.id, title: "Mine", content: "x" } },
        { kind: "docs", doc: { id: theirs.id, title: "Copy", content: "y" } },
        { kind: "docs", doc: { title: "No content" } },
      ],
      { now: NOW },
    );
    expect(report.restored.docs).toBe(1);
    expect(report.skipped.map((s) => s.reason)).toEqual(["Already in your account.", "Not a valid document."]);
    expect((await db.select().from(documents)).find((d) => d.title === "Theirs")?.userId).toBe("b");
  });

  it("round-trips Export all: delete everything, restore the archive, get it back", async () => {
    const db = await freshDb();
    await db.insert(savedFlows).values({ userId: "a", clientId: 1, label: "1AC", data: JSON.stringify(flow(1)) });
    await db.insert(savedRounds).values({ userId: "a", clientId: 2, label: "TOC Finals", data: JSON.stringify(round(2, [1])) });
    await db.insert(documents).values({ title: "Blocks", content: "<p>b</p>", userId: "a" });
    const single = await exportOwnSavedItem(db, "a", "flows", 1);
    const archive = await exportAllOwnSavedData(db, "a", NOW);
    await db.delete(savedFlows);
    await db.delete(savedRounds);
    await db.delete(documents);

    const parsed = parseRestoreFile(JSON.parse(archive.body));
    if (!parsed.ok) throw new Error(parsed.error);
    const report = await restoreOwnSavedData(db, "a", parsed.entries, { now: NOW });
    expect(report).toEqual({ restored: { docs: 1, flows: 1, rounds: 1, practiceRounds: 0, wordCountRounds: 0, drills: 0 }, skipped: [] });
    expect((await listOwnSavedItems(db, "a", "docs")).map((d) => d.title)).toEqual(["Blocks"]);

    // The single-item file of the same flow is now a no-op.
    const again = parseRestoreFile(JSON.parse(single!.body));
    if (!again.ok) throw new Error(again.error);
    expect((await restoreOwnSavedData(db, "a", again.entries, { now: NOW })).skipped).toHaveLength(1);
  });
});
