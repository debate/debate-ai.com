/**
 * @fileoverview `DELETE /api/rounds/[clientId]` against a real in-memory
 * SQLite database. A plain delete removes only the round (its saved flows
 * stay). `?withFlows=1` also removes the round's saved flows, except those
 * another of the user's saved rounds points at, never touches another
 * user's rows, and keeps every flow when the round itself can't be read.
 */

import { createClient } from "@libsql/client";
import { and, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/libsql";
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import * as schema from "@/lib/database/schema";
import { savedFlows, savedRounds, user } from "@/lib/database/schema";
import { applySchema } from "@/lib/database/__tests__/schema-sql";

let db: ReturnType<typeof drizzle<typeof schema>>;
const session = vi.hoisted(() => ({ userId: null as string | null }));

vi.mock("@/lib/database/context", () => ({
  getDBFromContext: async () => db,
  getCloudflareContext: () => undefined,
}));
vi.mock("@/lib/auth/session", () => ({
  getUserId: async () => session.userId,
  getUserIdOrUnavailable: async () => session.userId,
}));

const roundOne = await import("@/app/api/rounds/[clientId]/route");

const now = new Date("2026-01-01T00:00:00Z");

function del(clientId: number, query = "") {
  return roundOne.DELETE(new NextRequest(`https://debate-ai.com/api/rounds/${clientId}${query}`, { method: "DELETE" }), {
    params: Promise.resolve({ clientId: String(clientId) }),
  });
}

async function addRound(userId: string, clientId: number, data: string | number[]) {
  const json = typeof data === "string" ? data : JSON.stringify({ id: clientId, flowIds: data });
  await db.insert(savedRounds).values({ userId, clientId, label: `R${clientId}`, data: json, createdAt: now, updatedAt: now });
}

async function addFlows(userId: string, ids: number[]) {
  await db
    .insert(savedFlows)
    .values(ids.map((clientId) => ({ userId, clientId, label: `F${clientId}`, data: "{}", createdAt: now, updatedAt: now })));
}

async function flowIds(userId: string) {
  const rows = await db.select({ clientId: savedFlows.clientId }).from(savedFlows).where(eq(savedFlows.userId, userId));
  return rows.map((r) => r.clientId).sort((a, b) => a - b);
}

async function roundExists(userId: string, clientId: number) {
  const rows = await db
    .select({ id: savedRounds.id })
    .from(savedRounds)
    .where(and(eq(savedRounds.userId, userId), eq(savedRounds.clientId, clientId)));
  return rows.length > 0;
}

beforeEach(async () => {
  const client = createClient({ url: ":memory:" });
  await applySchema(client);
  db = drizzle(client, { schema });
  await db.insert(user).values([
    { id: "u1", name: "One", email: "u1@example.com", createdAt: now, updatedAt: now },
    { id: "u2", name: "Two", email: "u2@example.com", createdAt: now, updatedAt: now },
  ]);
  session.userId = "u1";
});

describe("DELETE /api/rounds/[clientId]", () => {
  it("without withFlows removes only the round", async () => {
    await addRound("u1", 10, [1, 2]);
    await addFlows("u1", [1, 2]);
    const res = await del(10);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true });
    expect(await roundExists("u1", 10)).toBe(false);
    expect(await flowIds("u1")).toEqual([1, 2]);
  });

  it("with withFlows=1 removes the round's saved flows and reports them", async () => {
    await addRound("u1", 10, [1, 2, 3]);
    await addFlows("u1", [1, 2, 9]);
    const res = await del(10, "?withFlows=1");
    expect(res.status).toBe(200);
    // Flow 3 was never saved, so it isn't reported.
    expect(await res.json()).toEqual({ success: true, removedFlowIds: [1, 2], keptFlowIds: [], flowsUnreadable: false });
    expect(await roundExists("u1", 10)).toBe(false);
    expect(await flowIds("u1")).toEqual([9]);
  });

  it("keeps a flow another saved round uses", async () => {
    await addRound("u1", 10, [1, 2]);
    await addRound("u1", 11, [2]);
    await addFlows("u1", [1, 2]);
    const res = await del(10, "?withFlows=1");
    expect(await res.json()).toEqual({ success: true, removedFlowIds: [1], keptFlowIds: [2], flowsUnreadable: false });
    expect(await flowIds("u1")).toEqual([2]);
    expect(await roundExists("u1", 11)).toBe(true);
  });

  it("never touches another user's flows or rounds, even with the same ids", async () => {
    await addRound("u1", 10, [1]);
    await addFlows("u1", [1]);
    await addRound("u2", 10, [1]);
    await addFlows("u2", [1]);
    await del(10, "?withFlows=1");
    expect(await flowIds("u1")).toEqual([]);
    expect(await flowIds("u2")).toEqual([1]);
    expect(await roundExists("u2", 10)).toBe(true);
  });

  it("another user's round using the same flow id doesn't keep this user's flow", async () => {
    await addRound("u1", 10, [1]);
    await addFlows("u1", [1]);
    await addRound("u2", 11, [1]);
    const res = await del(10, "?withFlows=1");
    expect((await res.json()).removedFlowIds).toEqual([1]);
  });

  it("removes a round it can't read without touching any flow", async () => {
    await addRound("u1", 10, '{"flowIds":[1');
    await addFlows("u1", [1]);
    const res = await del(10, "?withFlows=1");
    expect(await res.json()).toEqual({ success: true, removedFlowIds: [], keptFlowIds: [], flowsUnreadable: true });
    expect(await roundExists("u1", 10)).toBe(false);
    expect(await flowIds("u1")).toEqual([1]);
  });

  it("treats another round it can't read as using no flows", async () => {
    await addRound("u1", 10, [1]);
    await addRound("u1", 11, "not json");
    await addFlows("u1", [1]);
    const res = await del(10, "?withFlows=1");
    expect((await res.json()).removedFlowIds).toEqual([1]);
  });

  it("removes more flows than fit in one query", async () => {
    const ids = Array.from({ length: 120 }, (_, i) => i + 1);
    await addRound("u1", 10, ids);
    await addFlows("u1", ids);
    const res = await del(10, "?withFlows=1");
    expect((await res.json()).removedFlowIds).toHaveLength(120);
    expect(await flowIds("u1")).toEqual([]);
  });

  it("answers an empty result for a round that isn't saved", async () => {
    await addFlows("u1", [1]);
    const res = await del(10, "?withFlows=1");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true, removedFlowIds: [], keptFlowIds: [], flowsUnreadable: false });
    expect(await flowIds("u1")).toEqual([1]);
  });

  it("answers 401 signed out and 400 for a bad id", async () => {
    session.userId = null;
    expect((await del(10, "?withFlows=1")).status).toBe(401);
    session.userId = "u1";
    const bad = await roundOne.DELETE(new NextRequest("https://debate-ai.com/api/rounds/x", { method: "DELETE" }), {
      params: Promise.resolve({ clientId: "x" }),
    });
    expect(bad.status).toBe(400);
  });
});
