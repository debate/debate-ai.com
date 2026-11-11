/** @fileoverview Per-item list/delete of saved work, against in-memory SQLite. */
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { describe, expect, it } from "vitest";
import * as schema from "../../database/schema";
import { applySchema } from "../../database/__tests__/schema-sql";
import { documents, practiceVsAiDebates, savedDrillSets, savedFlows, savedRounds, user } from "../../database/schema";
import { DRILL_SETS_HREF, EXPORT_MAX_ITEMS, EXPORT_PAGE_SIZE, MAX_ITEMS, deleteOwnSavedItem, drillSetTitle, exportAllOwnSavedData, exportOwnSavedItem, isDeletableItemKind, isItemKind, listOwnSavedItems, listOwnSavedItemsPage, titleContains } from "../saved-data-items";

async function freshDb() {
  const client = createClient({ url: ":memory:" });
  await applySchema(client);
  const db = drizzle(client, { schema });
  const row = (id: string) => ({ id, name: id, email: `${id}@example.com`, createdAt: new Date("2024-09-01"), updatedAt: new Date("2024-09-01") });
  await db.insert(user).values([row("a"), row("b")]);
  return db;
}

describe("saved item management", () => {
  it("lists only the caller's rows, newest first, skipping folders", async () => {
    const db = await freshDb();
    await db.insert(documents).values([
      { title: "Old", userId: "a", updatedAt: new Date("2024-01-01") },
      { title: "New", userId: "a", updatedAt: new Date("2024-02-01") },
      { title: "Folder", userId: "a", isFolder: true },
      { title: "Theirs", userId: "b" },
    ]);
    const items = await listOwnSavedItems(db, "a", "docs");
    expect(items.map((i) => i.title)).toEqual(["New", "Old"]);
    expect(items[0].href).toBe(`/reason-editor?doc=${items[0].id}`);
  });

  it("falls back to a placeholder title for unlabeled flows", async () => {
    const db = await freshDb();
    await db.insert(savedFlows).values({ userId: "a", clientId: 7, data: "{}" });
    expect(await listOwnSavedItems(db, "a", "flows")).toMatchObject([{ id: 7, title: "Untitled flow", href: "/debate?flowId=7" }]);
  });

  it("links rounds to the ?roundId= deep link", async () => {
    const db = await freshDb();
    await db.insert(savedRounds).values([
      { userId: "a", clientId: 9, label: "Finals", data: "{}" },
      { userId: "a", clientId: 11, data: "{}", updatedAt: new Date(2020, 0, 1) },
      { userId: "b", clientId: 10, data: "{}" },
    ]);
    expect(await listOwnSavedItems(db, "a", "rounds")).toMatchObject([
      { id: 9, title: "Finals", href: "/debate?roundId=9" },
      { id: 11, title: "Untitled round", href: "/debate?roundId=11" },
    ]);
  });

  it("links practice debates to the Debate History deep link", async () => {
    const db = await freshDb();
    await db.insert(practiceVsAiDebates).values({ userId: "a", topic: "Tariffs", botName: "Bot", data: "{}" });
    const [item] = await listOwnSavedItems(db, "a", "practiceRounds");
    expect(item.href).toBe(`/practice/versus-ai?debate=${item.id}`);
  });

  it("links saved rounds to the debate page by their local id", async () => {
    const db = await freshDb();
    await db.insert(savedRounds).values({ userId: "a", clientId: 9, data: "{}" });
    expect(await listOwnSavedItems(db, "a", "rounds")).toMatchObject([{ id: 9, title: "Untitled round", href: "/debate?roundId=9" }]);
  });

  it("deletes own rows and refuses another user's or a missing row", async () => {
    const db = await freshDb();
    await db.insert(savedFlows).values([
      { userId: "a", clientId: 1, data: "{}" },
      { userId: "b", clientId: 1, data: "{}" },
    ]);
    expect(await deleteOwnSavedItem(db, "a", "flows", 1)).toBe(true);
    expect(await deleteOwnSavedItem(db, "a", "flows", 1)).toBe(false);
    expect(await listOwnSavedItems(db, "b", "flows")).toHaveLength(1);
  });

  it("pages through a kind with offset and reports whether more follow", async () => {
    const db = await freshDb();
    await db.insert(savedFlows).values([1, 2, 3, 4, 5].map((n) => ({ userId: "a", clientId: n, label: `F${n}`, data: "{}", updatedAt: new Date(2024, 0, n) })));
    const first = await listOwnSavedItemsPage(db, "a", "flows", 2, 0);
    expect(first.items.map((i) => i.title)).toEqual(["F5", "F4"]);
    expect(first.hasMore).toBe(true);
    const last = await listOwnSavedItemsPage(db, "a", "flows", 2, 4);
    expect(last).toMatchObject({ items: [{ title: "F1" }], hasMore: false });
    expect((await listOwnSavedItemsPage(db, "a", "flows", 5, 0)).hasMore).toBe(false);
    expect((await listOwnSavedItemsPage(db, "a", "flows", 2, 10)).items).toEqual([]);
  });

  it("filters by a case-insensitive title substring, only within the caller's rows", async () => {
    const db = await freshDb();
    await db.insert(documents).values([
      { title: "Aff Case", userId: "a" },
      { title: "Neg blocks", userId: "a" },
      { title: "aff frontlines", userId: "a" },
      { title: "AFF theirs", userId: "b" },
    ]);
    expect((await listOwnSavedItems(db, "a", "docs", MAX_ITEMS, 0, "AFF")).map((i) => i.title).sort()).toEqual(["Aff Case", "aff frontlines"]);
    expect(await listOwnSavedItems(db, "a", "docs", MAX_ITEMS, 0, "   ")).toHaveLength(3);
    expect(await listOwnSavedItems(db, "a", "docs", MAX_ITEMS, 0, "nothing")).toEqual([]);
  });

  it("matches %, _ and backslash in a search literally", async () => {
    const db = await freshDb();
    await db.insert(savedFlows).values([
      { userId: "a", clientId: 1, label: "50% tariffs", data: "{}" },
      { userId: "a", clientId: 2, label: "500 tariffs", data: "{}" },
      { userId: "a", clientId: 3, label: "a_b", data: "{}" },
      { userId: "a", clientId: 4, label: "axb", data: "{}" },
      { userId: "a", clientId: 5, label: "C:\\flows", data: "{}" },
    ]);
    const titles = async (q: string) => (await listOwnSavedItems(db, "a", "flows", MAX_ITEMS, 0, q)).map((i) => i.title);
    expect(await titles("0%")).toEqual(["50% tariffs"]);
    expect(await titles("a_b")).toEqual(["a_b"]);
    expect(await titles("\\")).toEqual(["C:\\flows"]);
    expect(titleContains(savedFlows.label, "")).toBeUndefined();
  });

  it("searches rounds by label and practice debates by topic or opponent", async () => {
    const db = await freshDb();
    await db.insert(savedRounds).values([
      { userId: "a", clientId: 1, label: "Octas vs Lincoln", data: "{}" },
      { userId: "a", clientId: 2, label: "Quarters", data: "{}" },
    ]);
    await db.insert(practiceVsAiDebates).values([
      { userId: "a", topic: "Tariffs", botName: "Socrates", data: "{}" },
      { userId: "a", topic: "Nuclear power", botName: "Lincoln", data: "{}" },
      { userId: "b", topic: "Lincoln", botName: "Bot", data: "{}" },
    ]);
    expect((await listOwnSavedItems(db, "a", "rounds", MAX_ITEMS, 0, "lincoln")).map((i) => i.id)).toEqual([1]);
    expect((await listOwnSavedItems(db, "a", "practiceRounds", MAX_ITEMS, 0, "lincoln")).map((i) => i.title)).toEqual(["Nuclear power"]);
    expect((await listOwnSavedItems(db, "a", "practiceRounds", MAX_ITEMS, 0, "tariff")).map((i) => i.title)).toEqual(["Tariffs"]);
  });

  it("pages through search results with hasMore", async () => {
    const db = await freshDb();
    await db.insert(savedFlows).values([1, 2, 3, 4].map((n) => ({ userId: "a", clientId: n, label: n % 2 ? `Aff ${n}` : `Neg ${n}`, data: "{}", updatedAt: new Date(2024, 0, n) })));
    await db.insert(savedFlows).values({ userId: "a", clientId: 5, label: "Aff 5", data: "{}", updatedAt: new Date(2024, 0, 5) });
    const first = await listOwnSavedItemsPage(db, "a", "flows", 2, 0, "aff");
    expect(first).toMatchObject({ hasMore: true });
    expect(first.items.map((i) => i.title)).toEqual(["Aff 5", "Aff 3"]);
    const second = await listOwnSavedItemsPage(db, "a", "flows", 2, 2, "aff");
    expect(second.items.map((i) => i.title)).toEqual(["Aff 1"]);
    expect(second.hasMore).toBe(false);
  });

  it("validates kinds", () => {
    expect(isItemKind("docs")).toBe(true);
    expect(isItemKind("drills")).toBe(true);
    expect(isItemKind("speeches")).toBe(false);
  });

  it("marks drill sets read-only and every other kind deletable", () => {
    expect(isDeletableItemKind("drills")).toBe(false);
    for (const kind of ["docs", "flows", "rounds", "practiceRounds"] as const) expect(isDeletableItemKind(kind)).toBe(true);
  });
});

describe("saved drill sets", () => {
  const drillSet = (roundId: string, drills: number) => JSON.stringify({ roundId, sideKey: "aff", drills: Array.from({ length: drills }, (_, i) => ({ kind: "overview", prompt: `d${i}` })) });

  it("titles a drill set by its round and drill count, tolerating bad data", () => {
    expect(drillSetTitle("12", drillSet("12", 3))).toBe("Round 12 · 3 drills");
    expect(drillSetTitle("12", drillSet("12", 1))).toBe("Round 12 · 1 drill");
    expect(drillSetTitle("12", "not json")).toBe("Round 12");
    expect(drillSetTitle("12", "null")).toBe("Round 12");
    expect(drillSetTitle("", "{}")).toBe("Drill set");
  });

  it("lists only the caller's drill sets, newest first, opening the Drill Sets page", async () => {
    const db = await freshDb();
    await db.insert(savedDrillSets).values([
      { userId: "a", clientId: "1", data: drillSet("1", 2), updatedAt: new Date("2024-01-01") },
      { userId: "a", clientId: "2", data: drillSet("2", 4), updatedAt: new Date("2024-02-01") },
      { userId: "b", clientId: "3", data: drillSet("3", 1) },
    ]);
    const page = await listOwnSavedItemsPage(db, "a", "drills");
    expect(page.deletable).toBe(false);
    expect(page.hasMore).toBe(false);
    expect(page.items.map((i) => i.title)).toEqual(["Round 2 · 4 drills", "Round 1 · 2 drills"]);
    expect(page.items.every((i) => i.href === DRILL_SETS_HREF)).toBe(true);
    expect((await listOwnSavedItemsPage(db, "a", "flows")).deletable).toBe(true);
  });

  it("exports a drill set's parsed record by row id, and refuses another user's", async () => {
    const db = await freshDb();
    await db.insert(savedDrillSets).values([
      { userId: "a", clientId: "7", data: drillSet("7", 2) },
      { userId: "b", clientId: "8", data: drillSet("8", 1) },
    ]);
    const [mine] = await listOwnSavedItems(db, "a", "drills");
    const file = await exportOwnSavedItem(db, "a", "drills", mine.id);
    expect(file?.filename).toBe(`drills-${mine.id}-round-7-2-drills.json`);
    expect(JSON.parse(file!.body)).toMatchObject({ kind: "drills", roundId: "7", data: { roundId: "7", sideKey: "aff" } });
    const [theirs] = await listOwnSavedItems(db, "b", "drills");
    expect(await exportOwnSavedItem(db, "a", "drills", theirs.id)).toBeNull();
  });

  it("includes drill sets in the bulk export", async () => {
    const db = await freshDb();
    await db.insert(savedDrillSets).values({ userId: "a", clientId: "5", data: drillSet("5", 1) });
    const body = JSON.parse((await exportAllOwnSavedData(db, "a")).body);
    expect(body.drills).toMatchObject([{ roundId: "5", title: "Round 5 · 1 drill" }]);
  });
});

describe("saved item export", () => {
  it("exports a doc's content as JSON with a safe filename", async () => {
    const db = await freshDb();
    await db.insert(documents).values({ title: "NC Case / v2!", content: "<p>hi</p>", userId: "a" });
    const [{ id }] = await listOwnSavedItems(db, "a", "docs");
    const file = await exportOwnSavedItem(db, "a", "docs", id);
    expect(file?.filename).toBe(`docs-${id}-nc-case-v2.json`);
    expect(JSON.parse(file!.body)).toMatchObject({ kind: "docs", title: "NC Case / v2!", format: "html", content: "<p>hi</p>" });
  });

  it("parses stored flow JSON, and keeps non-JSON data as a string", async () => {
    const db = await freshDb();
    await db.insert(savedFlows).values([
      { userId: "a", clientId: 1, label: "Aff", data: '{"cells":[1]}' },
      { userId: "a", clientId: 2, data: "not json" },
    ]);
    expect(JSON.parse((await exportOwnSavedItem(db, "a", "flows", 1))!.body).data).toEqual({ cells: [1] });
    const raw = JSON.parse((await exportOwnSavedItem(db, "a", "flows", 2))!.body);
    expect(raw).toMatchObject({ title: "Untitled flow", data: "not json" });
  });

  it("returns null for another user's, a missing, or a folder row", async () => {
    const db = await freshDb();
    await db.insert(savedFlows).values({ userId: "b", clientId: 1, data: "{}" });
    await db.insert(documents).values({ title: "Folder", userId: "a", isFolder: true });
    const [folder] = await db.select().from(documents);
    expect(await exportOwnSavedItem(db, "a", "flows", 1)).toBeNull();
    expect(await exportOwnSavedItem(db, "a", "flows", 99)).toBeNull();
    expect(await exportOwnSavedItem(db, "a", "docs", folder.id)).toBeNull();
  });
});

describe("bulk export", () => {
  it("bundles only the caller's rows from every kind with their content", async () => {
    const db = await freshDb();
    await db.insert(documents).values([{ title: "Mine", userId: "a", content: "<p>x</p>" }, { title: "Theirs", userId: "b" }]);
    await db.insert(savedFlows).values([{ userId: "a", clientId: 2, label: "F", data: '{"c":1}' }, { userId: "b", clientId: 3, data: "{}" }]);
    const file = await exportAllOwnSavedData(db, "a", new Date("2026-10-24T12:00:00Z"));
    expect(file.filename).toBe("debate-ai-saved-data-2026-10-24.json");
    const body = JSON.parse(file.body);
    expect(body.docs).toHaveLength(1);
    expect(body.docs[0]).toMatchObject({ title: "Mine", content: "<p>x</p>" });
    expect(body.flows).toMatchObject([{ id: 2, data: { c: 1 } }]);
    expect(body.rounds).toEqual([]);
    expect(body.practiceRounds).toEqual([]);
    expect(body.wordCountRounds).toEqual([]);
    expect(body.drills).toEqual([]);
  });

  it("includes the caller's word-count rounds and drill sets in the archive", async () => {
    const db = await freshDb();
    await db.insert(savedWordCountRounds).values([{ userId: "a", clientId: "w1", data: '{"submittedSpeeches":[]}' }, { userId: "b", clientId: "w2", data: "{}" }]);
    await db.insert(savedDrillSets).values({ userId: "a", clientId: "d1", data: '{"drills":[]}' });
    const body = JSON.parse((await exportAllOwnSavedData(db, "a")).body);
    expect(body.wordCountRounds).toMatchObject([{ kind: "wordCountRounds", roundId: "w1", title: "Word-count round · 0 speeches", data: { submittedSpeeches: [] } }]);
    expect(body.drills).toMatchObject([{ kind: "drills", roundId: "d1", title: "0 drills" }]);
  });

  it("exports every row, past the per-kind list cap and across page boundaries", async () => {
    const db = await freshDb();
    const total = EXPORT_PAGE_SIZE * 2 + 5;
    await db.insert(savedFlows).values(Array.from({ length: total }, (_, i) => ({ userId: "a", clientId: i + 1, data: "{}", updatedAt: new Date(2024, 0, 1, 0, 0, i) })));
    const body = JSON.parse((await exportAllOwnSavedData(db, "a")).body);
    expect(total).toBeGreaterThan(MAX_ITEMS);
    expect(body.flows).toHaveLength(total);
    expect(new Set(body.flows.map((f: { id: number }) => f.id)).size).toBe(total);
    expect(body.flows[0].id).toBe(total);
    expect(body.limitPerKind).toBe(EXPORT_MAX_ITEMS);
  });

  it("returns empty lists for a user with nothing saved", async () => {
    const body = JSON.parse((await exportAllOwnSavedData(await freshDb(), "a")).body);
    expect([body.docs, body.flows, body.rounds, body.practiceRounds, body.drills, body.truncated]).toEqual([[], [], [], [], [], []]);
  });

  it("exports past the 100-row list cap, with nothing marked truncated", async () => {
    const db = await freshDb();
    await db.insert(savedFlows).values(Array.from({ length: 130 }, (_, i) => ({ userId: "a", clientId: i + 1, label: `F${i}`, data: "{}" })));
    const body = JSON.parse((await exportAllOwnSavedData(db, "a")).body);
    expect(body.flows).toHaveLength(130);
    expect(new Set(body.flows.map((f: { id: number }) => f.id)).size).toBe(130);
    expect(body.truncated).toEqual([]);
  });

  it("stops at the ceiling and names the truncated kinds", async () => {
    const db = await freshDb();
    await db.insert(savedFlows).values(Array.from({ length: 5 }, (_, i) => ({ userId: "a", clientId: i + 1, data: "{}", updatedAt: new Date(2024, 0, i + 1) })));
    await db.insert(documents).values([{ title: "Only", userId: "a" }]);
    const body = JSON.parse((await exportAllOwnSavedData(db, "a", new Date(), 3)).body);
    expect(body.limitPerKind).toBe(3);
    expect(body.flows.map((f: { id: number }) => f.id)).toEqual([5, 4, 3]);
    expect(body.truncated).toEqual(["flows"]);
  });

  it("does not flag a kind holding exactly the ceiling", async () => {
    const db = await freshDb();
    await db.insert(savedFlows).values([1, 2, 3].map((n) => ({ userId: "a", clientId: n, data: "{}" })));
    const body = JSON.parse((await exportAllOwnSavedData(db, "a", new Date(), 3)).body);
    expect(body.flows).toHaveLength(3);
    expect(body.truncated).toEqual([]);
  });

  it("exports more than the 100-row management-list cap", async () => {
    const db = await freshDb();
    const total = MAX_ITEMS + 5;
    await db.insert(savedFlows).values(Array.from({ length: total }, (_, i) => ({ userId: "a", clientId: i + 1, data: "{}" })));
    expect(await listOwnSavedItems(db, "a", "flows")).toHaveLength(MAX_ITEMS);
    const body = JSON.parse((await exportAllOwnSavedData(db, "a")).body);
    expect(body.flows).toHaveLength(total);
    expect(body.limitPerKind).toBe(EXPORT_MAX_ITEMS);
    expect(body.truncated).toEqual([]);
  });
});
