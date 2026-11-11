/**
 * @fileoverview `/api/word-count-rounds` and `/api/word-count-rounds/[roundId]`
 * against a real in-memory SQLite database: rows are linked to the signed-in
 * user, upserted per (user, round), never visible to or deletable by another
 * user, and validated before they're written.
 */

import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import * as schema from "@/lib/database/schema";
import { savedWordCountRounds, user } from "@/lib/database/schema";
import { applySchema } from "@/lib/database/__tests__/schema-sql";

let db: ReturnType<typeof drizzle<typeof schema>>;
const session = vi.hoisted(() => ({ userId: null as string | null }));

vi.mock("@/lib/database/context", () => ({
  getDBFromContext: async () => db,
  getCloudflareContext: () => undefined,
}));
vi.mock("@/lib/auth/session", () => ({
  getUserId: async () => session.userId,
}));

const { GET } = await import("@/app/api/word-count-rounds/route");
const { PUT, DELETE } = await import("@/app/api/word-count-rounds/[roundId]/route");

function record(roundId: string, extra: Record<string, unknown> = {}) {
  return {
    roundId,
    styleKey: "practicePublicForum",
    submittedSpeeches: [{ name: "AC", speaker: "A1", text: "Contention one." }],
    createdAt: 1,
    updatedAt: 2,
    ...extra,
  };
}

const params = (roundId: string) => ({ params: Promise.resolve({ roundId }) });

async function put(roundId: string, body: unknown) {
  const req = new NextRequest(`https://debate-ai.com/api/word-count-rounds/${encodeURIComponent(roundId)}`, {
    method: "PUT",
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
  const res = await PUT(req, params(roundId));
  return { status: res.status, body: await res.json() };
}

async function list() {
  const res = await GET();
  return { status: res.status, body: await res.json() };
}

async function remove(roundId: string) {
  const req = new NextRequest(`https://debate-ai.com/api/word-count-rounds/${roundId}`, { method: "DELETE" });
  const res = await DELETE(req, params(roundId));
  return { status: res.status, body: await res.json() };
}

beforeEach(async () => {
  const client = createClient({ url: ":memory:" });
  await applySchema(client);
  db = drizzle(client, { schema });
  const now = new Date("2026-01-01");
  await db.insert(user).values([
    { id: "u1", name: "One", email: "u1@example.com", createdAt: now, updatedAt: now },
    { id: "u2", name: "Two", email: "u2@example.com", createdAt: now, updatedAt: now },
  ]);
  session.userId = "u1";
});

describe("/api/word-count-rounds", () => {
  it("answers 401 to every method when signed out, and writes nothing", async () => {
    session.userId = null;
    expect((await list()).status).toBe(401);
    expect((await put("r1", { record: record("r1") })).status).toBe(401);
    expect((await remove("r1")).status).toBe(401);
    expect(await db.select().from(savedWordCountRounds)).toEqual([]);
  });

  it("saves a round under the signed-in user and lists it back", async () => {
    const saved = await put("r1", { record: record("r1") });
    expect(saved.status).toBe(200);
    expect(saved.body.roundId).toBe("r1");

    const rows = await db.select().from(savedWordCountRounds);
    expect(rows).toHaveLength(1);
    expect(rows[0].userId).toBe("u1");
    expect(rows[0].clientId).toBe("r1");

    expect(await list()).toEqual({ status: 200, body: [record("r1")] });
  });

  it("upserts a second save of the same round instead of adding a row", async () => {
    await put("r1", { record: record("r1") });
    await put("r1", { record: record("r1", { updatedAt: 9, submittedSpeeches: [] }) });

    expect(await db.select().from(savedWordCountRounds)).toHaveLength(1);
    expect((await list()).body).toEqual([record("r1", { updatedAt: 9, submittedSpeeches: [] })]);
  });

  it("keeps users' rounds apart, even with the same round id", async () => {
    await put("r1", { record: record("r1") });
    session.userId = "u2";
    await put("r1", { record: record("r1", { updatedAt: 50 }) });

    expect((await list()).body).toEqual([record("r1", { updatedAt: 50 })]);
    expect(await remove("r1")).toEqual({ status: 200, body: { success: true } });

    session.userId = "u1";
    expect((await list()).body).toEqual([record("r1")]);
  });

  it("rejects invalid bodies with 400", async () => {
    expect((await put("r1", "{not json")).status).toBe(400);
    expect((await put("r1", {})).status).toBe(400);
    expect((await put("r1", { record: record("r1", { styleKey: "nope" }) })).status).toBe(400);
    expect((await put("r1", { record: record("other") })).body.error).toContain("must match");
    expect(await db.select().from(savedWordCountRounds)).toEqual([]);
  });

  it("refuses a round over the size cap with 413", async () => {
    const huge = record("r1", { submittedSpeeches: [{ name: "AC", speaker: "A1", text: "x".repeat(200_001) }] });
    expect((await put("r1", { record: huge })).status).toBe(413);
    expect(await db.select().from(savedWordCountRounds)).toEqual([]);
  });

  it("deletes only the named round, and a repeated delete is harmless", async () => {
    await put("r1", { record: record("r1") });
    await put("r2", { record: record("r2") });

    expect((await remove("r1")).status).toBe(200);
    expect((await remove("r1")).status).toBe(200);
    expect((await list()).body.map((r: { roundId: string }) => r.roundId)).toEqual(["r2"]);
  });

  it("skips a row whose stored JSON is corrupt instead of failing the list", async () => {
    await put("r1", { record: record("r1") });
    const now = new Date();
    await db.insert(savedWordCountRounds).values({ userId: "u1", clientId: "bad", data: "{oops", createdAt: now, updatedAt: now });

    expect(await list()).toEqual({ status: 200, body: [record("r1")] });
  });
});
