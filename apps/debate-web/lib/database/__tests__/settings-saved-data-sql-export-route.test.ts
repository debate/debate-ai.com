/**
 * @fileoverview `GET /api/settings/saved-data?export=sql&key=<key>` (export
 * one "More saved work" table) against a real SQLite database: sign-in
 * required, unknown keys rejected, and only the caller's rows of that one
 * table in the file.
 */

import { drizzle } from "drizzle-orm/libsql";
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import * as schema from "@/lib/database/schema";
import { freshSchemaClient } from "@/lib/database/__tests__/schema-sql";

let db: ReturnType<typeof drizzle<typeof schema>>;
let signedInAs: string | null = "user-1";

vi.mock("@/lib/database/context", () => ({ getDBFromContext: async () => db }));
vi.mock("@/lib/auth/session", () => ({
  getUserId: async () => signedInAs,
  getSession: async () => (signedInAs ? { user: { id: signedInAs, name: "Ada" } } : null),
}));

const { GET } = await import("@/app/api/settings/saved-data/route");

const exportSql = (key: string | null) =>
  GET(new NextRequest(`http://localhost/api/settings/saved-data?export=sql${key === null ? "" : `&key=${encodeURIComponent(key)}`}`));

describe("GET /api/settings/saved-data?export=sql", () => {
  beforeEach(async () => {
    signedInAs = "user-1";
    db = drizzle(await freshSchemaClient(), { schema });
    const now = new Date();
    await db.insert(schema.user).values(["user-1", "user-2"].map((id) => ({ id, name: id, email: `${id}@example.com`, createdAt: now, updatedAt: now })));
    await db.insert(schema.savedLearnDecks).values([
      { userId: "user-1", clientId: "d1", data: JSON.stringify({ name: "Mine" }) },
      { userId: "user-2", clientId: "d9", data: JSON.stringify({ name: "Theirs" }) },
    ]);
    await db.insert(schema.savedQuickCards).values({ userId: "user-1", clientId: "q1", data: "{}" });
  });

  it("rejects a signed-out caller", async () => {
    signedInAs = null;
    expect((await exportSql("learnDecks")).status).toBe(401);
  });

  it("rejects a missing or unknown key with a message", async () => {
    for (const key of [null, "", "docs", "pinnedDebates"]) {
      const res = await exportSql(key);
      expect(res.status).toBe(400);
      expect((await res.json()).error).toContain("saved work");
    }
  });

  it("downloads only the caller's rows of that table, as an attachment", async () => {
    const res = await exportSql("learnDecks");
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Disposition")).toMatch(/^attachment; filename="moreSavedWork-learndecks-\d{4}-\d{2}-\d{2}\.json"$/);
    const file = await res.json();
    expect(Object.keys(file.moreSavedWork)).toEqual(["learnDecks"]);
    expect(file.moreSavedWork.learnDecks).toMatchObject([{ clientId: "d1", data: { name: "Mine" } }]);
    expect(JSON.stringify(file)).not.toContain("Theirs");
    expect(file.moreSavedWorkTruncated).toEqual([]);
  });
});
