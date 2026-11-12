/**
 * @fileoverview `POST /api/settings/saved-data` (restore from an export file)
 * against a real SQLite database: sign-in required, bad files rejected with a
 * readable error, and a valid file restored into the caller's account only.
 */

import { drizzle } from "drizzle-orm/libsql";
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import * as schema from "@/lib/database/schema";
import { freshSchemaClient } from "@/lib/database/__tests__/schema-sql";
import { MAX_RESTORE_FILE_CHARS } from "@/lib/saved-data/saved-data-restore";

let db: ReturnType<typeof drizzle<typeof schema>>;
let signedInAs: string | null = "user-1";

vi.mock("@/lib/database/context", () => ({ getDBFromContext: async () => db }));
vi.mock("@/lib/auth/session", () => ({
  getUserId: async () => signedInAs,
  getSession: async () => (signedInAs ? { user: { id: signedInAs, name: "Ada" } } : null),
}));

const { POST } = await import("@/app/api/settings/saved-data/route");

const post = (body: string) => POST(new NextRequest("http://localhost/api/settings/saved-data", { method: "POST", body }));

const flow = { id: 7, content: "1AC", level: 0, columns: ["1AC"], invert: false, focus: false, index: 0, lastFocus: [], children: [] };

describe("POST /api/settings/saved-data", () => {
  beforeEach(async () => {
    signedInAs = "user-1";
    db = drizzle(await freshSchemaClient(), { schema });
    const now = new Date();
    await db.insert(schema.user).values(["user-1", "user-2"].map((id) => ({ id, name: id, email: `${id}@example.com`, createdAt: now, updatedAt: now })));
  });

  it("rejects a signed-out caller", async () => {
    signedInAs = null;
    expect((await post("{}")).status).toBe(401);
  });

  it("rejects invalid JSON, non-export files and oversized files with a message", async () => {
    const bad = await post("not json");
    expect(bad.status).toBe(400);
    expect((await bad.json()).error).toContain("valid JSON");
    const wrong = await post('{"hello":1}');
    expect(wrong.status).toBe(400);
    expect((await wrong.json()).error).toContain("export file");
    expect((await post(" ".repeat(MAX_RESTORE_FILE_CHARS + 1))).status).toBe(413);
  });

  it("restores a single-item export into the caller's account and reports it", async () => {
    const res = await post(JSON.stringify({ kind: "flows", id: 7, title: "1AC", data: flow }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ restored: { docs: 0, flows: 1, rounds: 0, practiceRounds: 0, wordCountRounds: 0, drills: 0 }, skipped: [] });
    const rows = await db.select().from(schema.savedFlows);
    expect(rows).toMatchObject([{ userId: "user-1", clientId: 7 }]);
  });

  it("stamps restored documents with the caller's name as author", async () => {
    await post(JSON.stringify({ exportedAt: "2026-11-11", docs: [{ id: 99, title: "Blocks", content: "<p>b</p>" }] }));
    expect(await db.select().from(schema.documents)).toMatchObject([{ userId: "user-1", title: "Blocks", author: "Ada" }]);
  });
});
