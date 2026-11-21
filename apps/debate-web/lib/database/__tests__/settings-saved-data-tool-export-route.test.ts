/**
 * @fileoverview `GET /api/settings/saved-data?export=tool&collection=<key>`
 * (export one tool's synced data) against a real SQLite database: sign-in
 * required, unknown keys rejected, only the caller's records of that one
 * collection in the file, and the file restores through `POST`.
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

const { GET, POST } = await import("@/app/api/settings/saved-data/route");

const exportTool = (collection: string | null) =>
  GET(new NextRequest(`http://localhost/api/settings/saved-data?export=tool${collection === null ? "" : `&collection=${encodeURIComponent(collection)}`}`));

const pin = (roundId: string) => ({ roundId, pinnedAt: 1 });

describe("GET /api/settings/saved-data?export=tool", () => {
  beforeEach(async () => {
    signedInAs = "user-1";
    db = drizzle(await freshSchemaClient(), { schema });
    const now = new Date();
    await db.insert(schema.user).values(["user-1", "user-2"].map((id) => ({ id, name: id, email: `${id}@example.com`, createdAt: now, updatedAt: now })));
    await db.insert(schema.savedToolRecords).values([
      { userId: "user-1", collection: "pinnedDebates", clientId: "r1", data: JSON.stringify(pin("r1")) },
      { userId: "user-1", collection: "flowKeymap", clientId: "next", data: JSON.stringify({ id: "next", keys: ["Tab"] }) },
      { userId: "user-2", collection: "pinnedDebates", clientId: "r9", data: JSON.stringify(pin("r9")) },
    ]);
  });

  it("rejects a signed-out caller", async () => {
    signedInAs = null;
    expect((await exportTool("pinnedDebates")).status).toBe(401);
  });

  it("rejects a missing or unknown collection with a message", async () => {
    for (const key of [null, "", "retiredTool"]) {
      const res = await exportTool(key);
      expect(res.status).toBe(400);
      expect((await res.json()).error).toContain("tool");
    }
  });

  it("downloads only the caller's records of that collection, as an attachment", async () => {
    const res = await exportTool("pinnedDebates");
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Disposition")).toMatch(/^attachment; filename="toolRecords-pinneddebates-\d{4}-\d{2}-\d{2}\.json"$/);
    const file = await res.json();
    expect(file.toolRecords).toEqual({ pinnedDebates: [pin("r1")] });
    expect(file.toolRecordsTruncated).toBe(false);
  });

  it("restores through POST after the records are deleted", async () => {
    const body = await (await exportTool("pinnedDebates")).text();
    await db.delete(schema.savedToolRecords);
    const res = await POST(new NextRequest("http://localhost/api/settings/saved-data", { method: "POST", body }));
    expect(res.status).toBe(200);
    expect((await res.json()).restoredToolRecords).toBe(1);
    expect(await db.select().from(schema.savedToolRecords)).toMatchObject([{ userId: "user-1", collection: "pinnedDebates", clientId: "r1" }]);
  });
});
