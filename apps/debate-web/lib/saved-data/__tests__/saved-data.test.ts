/**
 * @fileoverview The account "Saved to your account" counts, against a real
 * in-memory SQLite database (correlated subqueries can't be seen through a
 * mocked drizzle handle).
 */
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { describe, expect, it } from "vitest";
import * as schema from "../../database/schema";
import { applySchema } from "../../database/__tests__/schema-sql";
import { documents, savedFlows, savedRounds, savedToolRecords, user } from "../../database/schema";
import { TOOL_RECORD_COLLECTIONS } from "@debate-ai/research-evidence/src/account-sync/toolRecordCollections";
import { APP_ROUTES } from "@debate-ai/webview/routes/index";
import { loadOwnSavedData, SAVED_DATA_KINDS, UNLINKED_TOOL_COLLECTIONS } from "../saved-data";

async function freshDb() {
  const client = createClient({ url: ":memory:" });
  await applySchema(client);
  return drizzle(client, { schema });
}

const userRow = (id: string) => ({
  id,
  name: `User ${id}`,
  email: `${id}@example.com`,
  createdAt: new Date("2024-09-01"),
  updatedAt: new Date("2024-09-01"),
});

describe("loadOwnSavedData", () => {
  it("counts only the caller's saved work, per kind", async () => {
    const db = await freshDb();
    await db.insert(user).values([userRow("a"), userRow("b")]);
    await db.insert(documents).values([
      { title: "One", userId: "a" },
      { title: "Two", userId: "a" },
      { title: "Other", userId: "b" },
    ]);
    await db.insert(savedFlows).values([
      { userId: "a", clientId: 1, data: "{}" },
      { userId: "b", clientId: 1, data: "{}" },
      { userId: "b", clientId: 2, data: "{}" },
    ]);
    await db.insert(savedRounds).values({ userId: "a", clientId: 1, data: "{}" });

    const summary = await loadOwnSavedData(db, "a");
    const byKey = Object.fromEntries(summary.items.map((item) => [item.key, item.count]));
    expect(byKey).toMatchObject({ docs: 2, flows: 1, rounds: 1, drills: 0 });
    const hrefs = Object.fromEntries(summary.items.map((item) => [item.key, item.href]));
    expect(hrefs).toMatchObject({ docs: "/reason-editor", flows: "/debate", wordCountRounds: "/word-count", drills: "/practice/drills" });
    expect(summary.total).toBe(4);
  });

  it("lists the caller's tool-record collections, skipping unknown keys and watch history", async () => {
    const db = await freshDb();
    await db.insert(user).values([userRow("a"), userRow("b")]);
    await db.insert(savedToolRecords).values([
      { userId: "a", collection: "flowKeymap", clientId: "x", data: "{}" },
      { userId: "a", collection: "flowKeymap", clientId: "y", data: "{}" },
      { userId: "a", collection: "debateVideoWatchHistory", clientId: "v", data: "{}" },
      { userId: "a", collection: "retiredCollection", clientId: "z", data: "{}" },
      { userId: "b", collection: "flowKeymap", clientId: "x", data: "{}" },
    ]);

    const summary = await loadOwnSavedData(db, "a");
    expect(summary.tools).toEqual([{ collection: "flowKeymap", label: "Flow Editor Shortcuts", count: 2, href: "/debate" }]);
    expect(summary.total).toBe(2);
  });

  it("returns zeros for an account with nothing saved or an unknown id", async () => {
    const db = await freshDb();
    await db.insert(user).values(userRow("a"));
    for (const id of ["a", "missing"]) {
      const summary = await loadOwnSavedData(db, id);
      expect(summary.total).toBe(0);
      expect(summary.tools).toEqual([]);
      expect(summary.items.every((item) => item.count === 0)).toBe(true);
    }
  });
});

describe("saved-data open links", () => {
  const routes = new Set(APP_ROUTES.map((route) => route.pattern));
  const path = (href: string) => href.split("?")[0];

  it("points every saved kind at a page the app actually serves", () => {
    for (const kind of SAVED_DATA_KINDS) expect(routes, `${kind.key} → ${kind.href}`).toContain(path(kind.href));
  });

  it("points every synced tool collection at a page the app actually serves, bar the declared gaps", () => {
    for (const c of TOOL_RECORD_COLLECTIONS) {
      if (UNLINKED_TOOL_COLLECTIONS.has(c.key)) expect(routes, `${c.key} is served again; drop it from UNLINKED_TOOL_COLLECTIONS`).not.toContain(path(c.href));
      else expect(routes, `${c.key} → ${c.href}`).toContain(path(c.href));
    }
  });

  it("shows an unlinked collection's count without a link", async () => {
    const db = await freshDb();
    await db.insert(user).values(userRow("a"));
    await db.insert(savedToolRecords).values({ userId: "a", collection: "vulnerabilityReports", clientId: "r", data: "{}" });
    const summary = await loadOwnSavedData(db, "a");
    expect(summary.tools).toEqual([expect.objectContaining({ collection: "vulnerabilityReports", count: 1, href: null })]);
  });
});
