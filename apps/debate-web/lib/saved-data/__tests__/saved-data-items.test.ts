/** @fileoverview Per-item list/delete of saved work, against in-memory SQLite. */
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { describe, expect, it } from "vitest";
import * as schema from "../../database/schema";
import { applySchema } from "../../database/__tests__/schema-sql";
import { documents, practiceVsAiDebates, savedFlows, savedRounds, user } from "../../database/schema";
import { EXPORT_PAGE_SIZE, MAX_ITEMS, deleteOwnSavedItem, exportAllOwnSavedData, exportOwnSavedItem, isItemKind, listOwnSavedItems, listOwnSavedItemsPage } from "../saved-data-items";

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

  it("validates kinds", () => {
    expect(isItemKind("docs")).toBe(true);
    expect(isItemKind("drills")).toBe(false);
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
    expect(body.limitPerKind).toBeUndefined();
  });

  it("returns empty lists for a user with nothing saved", async () => {
    const body = JSON.parse((await exportAllOwnSavedData(await freshDb(), "a")).body);
    expect([body.docs, body.flows, body.rounds, body.practiceRounds]).toEqual([[], [], [], []]);
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
