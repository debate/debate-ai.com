/**
 * @fileoverview `/api/contacts/block` against a real SQLite database: blocking
 * is idempotent, unilateral, and severs any contact between the two accounts;
 * unblocking only removes the block.
 */

import { NextRequest } from "next/server";
import { drizzle } from "drizzle-orm/libsql";
import { and, eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";

import * as schema from "@/lib/database/schema";
import { freshSchemaClient } from "@/lib/database/__tests__/schema-sql";

let db: ReturnType<typeof drizzle<typeof schema>>;
let signedInAs: string | null = "alex";

vi.mock("@/lib/database/context", () => ({ getDBFromContext: async () => db }));
vi.mock("@/lib/auth/session", () => ({
  getSession: async () => (signedInAs ? { user: { id: signedInAs }, session: {} } : null),
}));

const route = await import("@/app/api/contacts/block/route");

const send = (method: "POST" | "DELETE", body: unknown) =>
  route[method](
    new NextRequest("https://debate-ai.com/api/contacts/block", { method, body: typeof body === "string" ? body : JSON.stringify(body) }),
  );
const blocks = () => db.select().from(schema.userBlocks);

describe("/api/contacts/block", () => {
  beforeEach(async () => {
    signedInAs = "alex";
    db = drizzle(await freshSchemaClient(), { schema });
    const now = new Date();
    await db.insert(schema.user).values(["alex", "sam"].map((id) => ({ id, name: id, email: `${id}@example.com`, createdAt: now, updatedAt: now })));
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("requires a session", async () => {
    signedInAs = null;
    expect((await send("POST", { userId: "sam" })).status).toBe(401);
    expect((await send("DELETE", { userId: "sam" })).status).toBe(401);
  });

  it("validates the target", async () => {
    expect((await send("POST", {})).status).toBe(400);
    expect((await send("POST", "{nope")).status).toBe(400);
    expect((await send("POST", { userId: "   " })).status).toBe(400);
    expect((await send("DELETE", {})).status).toBe(400);
    const self = await send("POST", { userId: "alex" });
    expect(await self.json()).toEqual({ error: "You can't block yourself." });
    expect((await send("POST", { userId: "ghost" })).status).toBe(404);
  });

  it("blocks idempotently and severs an existing contact", async () => {
    await db.insert(schema.contacts).values({ requesterId: "sam", addresseeId: "alex", status: "accepted" });
    expect((await send("POST", { userId: " sam " })).status).toBe(200);
    expect((await send("POST", { userId: "sam" })).status).toBe(200);

    expect(await blocks()).toHaveLength(1);
    expect(await db.select().from(schema.contacts)).toEqual([]);
  });

  it("unblocks only the caller's own block", async () => {
    await db.insert(schema.userBlocks).values([
      { blockerId: "alex", blockedId: "sam" },
      { blockerId: "sam", blockedId: "alex" },
    ]);
    expect((await send("DELETE", { userId: "sam" })).status).toBe(200);
    const left = await blocks();
    expect(left).toHaveLength(1);
    expect(left[0]).toMatchObject({ blockerId: "sam", blockedId: "alex" });
    expect(
      await db.select().from(schema.userBlocks).where(and(eq(schema.userBlocks.blockerId, "alex"), eq(schema.userBlocks.blockedId, "sam"))),
    ).toEqual([]);
  });

  it("answers 500 when the database fails", async () => {
    db = { select: () => { throw new Error("boom"); }, delete: () => { throw new Error("boom"); } };
    expect((await send("POST", { userId: "sam" })).status).toBe(500);
    expect((await send("DELETE", { userId: "sam" })).status).toBe(500);
  });
});
