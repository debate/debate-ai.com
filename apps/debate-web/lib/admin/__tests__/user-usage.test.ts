/**
 * @fileoverview Exercises the admin user-usage directory's search filter
 * against a real in-memory SQLite database, the same approach
 * `lib/videos/__tests__/admin-library.test.ts` uses: the LIKE-escaping
 * behavior this pins can't be seen through a mocked drizzle handle.
 */
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { describe, expect, it } from "vitest";
import * as schema from "../../database/schema";
import { applySchema } from "../../database/__tests__/schema-sql";
import { user } from "../../database/schema";
import { loadUserUsagePage } from "../user-usage";

async function freshDb() {
  const client = createClient({ url: ":memory:" });
  await applySchema(client);
  return drizzle(client, { schema });
}

type UserInsert = typeof user.$inferInsert;

function userRow(id: string, extra: Partial<UserInsert> = {}): UserInsert {
  return {
    id,
    name: `User ${id}`,
    email: `${id}@example.com`,
    createdAt: new Date("2024-09-01"),
    updatedAt: new Date("2024-09-01"),
    ...extra,
  };
}

describe("loadUserUsagePage", () => {
  it("treats a literal % or _ in the search text as itself, not a SQL wildcard", async () => {
    const db = await freshDb();
    await db.insert(user).values([
      userRow("a", { name: "50% Debate Club" }),
      userRow("b", { name: "50 Debate Club" }),
      userRow("c", { name: "Case_Neg Coach" }),
      userRow("d", { name: "CaseXNeg Coach" }),
    ]);

    const byPercent = await loadUserUsagePage(db, { page: 1, limit: 10, search: "50%" });
    expect(byPercent.users.map((r: any) => r.id)).toEqual(["a"]);

    const byUnderscore = await loadUserUsagePage(db, { page: 1, limit: 10, search: "Case_Neg" });
    expect(byUnderscore.users.map((r: any) => r.id)).toEqual(["c"]);
  });

  it("searches by name or email", async () => {
    const db = await freshDb();
    await db.insert(user).values([
      userRow("a", { name: "Harvard Squad" }),
      userRow("b", { name: "Someone Else", email: "harvard-coach@example.com" }),
      userRow("c", { name: "Berkeley Squad" }),
    ]);

    const byName = await loadUserUsagePage(db, { page: 1, limit: 10, search: "harvard" });
    expect(byName.users.map((r: any) => r.id).sort()).toEqual(["a", "b"]);
  });
});
