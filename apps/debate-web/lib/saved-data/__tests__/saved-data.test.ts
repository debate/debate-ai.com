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
import { loadOwnSavedData } from "../saved-data";

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
    expect(summary.tools).toEqual([{ collection: "flowKeymap", label: "Flow Editor Shortcuts", count: 2 }]);
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
