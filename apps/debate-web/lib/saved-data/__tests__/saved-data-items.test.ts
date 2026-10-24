/** @fileoverview Per-item list/delete of saved work, against in-memory SQLite. */
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { describe, expect, it } from "vitest";
import * as schema from "../../database/schema";
import { applySchema } from "../../database/__tests__/schema-sql";
import { documents, savedFlows, user } from "../../database/schema";
import { deleteOwnSavedItem, isItemKind, listOwnSavedItems } from "../saved-data-items";

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

  it("validates kinds", () => {
    expect(isItemKind("docs")).toBe(true);
    expect(isItemKind("drills")).toBe(false);
  });
});
