/**
 * @fileoverview Account-saved list routes against a real in-memory SQLite
 * database with one row whose `data` JSON can't be parsed: the list still
 * answers 200 with every readable row (it used to throw and answer a
 * bodiless 500, hiding all of the user's items), and a single saved flow or
 * round with broken JSON answers a described 422.
 */

import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import * as schema from "@/lib/database/schema";
import {
  savedCoachMaterials,
  savedDrillSets,
  savedFlows,
  savedRounds,
  savedToolRecords,
  user,
} from "@/lib/database/schema";
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

const drillSets = await import("@/app/api/drill-sets/route");
const coachMaterials = await import("@/app/api/coach-materials/route");
const toolRecordsAll = await import("@/app/api/tool-records/route");
const toolRecordsOne = await import("@/app/api/tool-records/[collection]/route");
const flowOne = await import("@/app/api/flows/[clientId]/route");
const roundOne = await import("@/app/api/rounds/[clientId]/route");
const { TOOL_RECORD_COLLECTIONS } = await import(
  "@debate-ai/research-evidence/src/account-sync/toolRecordCollections"
);

const req = (path: string) => new NextRequest(`https://debate-ai.com${path}`);
const at = (iso: string) => new Date(iso);

beforeEach(async () => {
  const client = createClient({ url: ":memory:" });
  await applySchema(client);
  db = drizzle(client, { schema });
  const now = at("2026-01-01T00:00:00Z");
  await db.insert(user).values([{ id: "u1", name: "One", email: "u1@example.com", createdAt: now, updatedAt: now }]);
  session.userId = "u1";
});

describe("list routes with a row whose data can't be parsed", () => {
  it("GET /api/drill-sets answers every readable drill set, in order", async () => {
    await db.insert(savedDrillSets).values([
      { userId: "u1", clientId: "a", data: '{"id":"a"}', createdAt: at("2026-01-01T00:00:01Z") },
      { userId: "u1", clientId: "b", data: '{"id":"b"', createdAt: at("2026-01-01T00:00:02Z") },
      { userId: "u1", clientId: "c", data: '{"id":"c"}', createdAt: at("2026-01-01T00:00:03Z") },
    ]);
    const res = await drillSets.GET(req("/api/drill-sets"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([{ id: "a" }, { id: "c" }]);
  });

  it("GET /api/coach-materials skips the broken row and still mixes in each row's updatedAt", async () => {
    const updatedAt = at("2026-02-01T00:00:00Z");
    await db.insert(savedCoachMaterials).values([
      { userId: "u1", clientId: "m1", data: "not json", updatedAt },
      { userId: "u1", clientId: "m2", data: '{"id":"m2"}', updatedAt },
    ]);
    const res = await coachMaterials.GET(req("/api/coach-materials"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([{ id: "m2", updatedAt: updatedAt.toISOString() }]);
  });

  it("GET /api/tool-records and /api/tool-records/[collection] skip the broken record", async () => {
    const key = TOOL_RECORD_COLLECTIONS[0].key;
    await db.insert(savedToolRecords).values([
      { userId: "u1", collection: key, clientId: "r1", data: "{", createdAt: at("2026-01-01T00:00:01Z") },
      { userId: "u1", collection: key, clientId: "r2", data: '{"id":"r2"}', createdAt: at("2026-01-01T00:00:02Z") },
    ]);

    const one = await toolRecordsOne.GET(req(`/api/tool-records/${key}`), {
      params: Promise.resolve({ collection: key }),
    });
    expect(one.status).toBe(200);
    expect(await one.json()).toEqual([{ id: "r2" }]);

    const all = await toolRecordsAll.GET(req("/api/tool-records"));
    expect(all.status).toBe(200);
    expect(((await all.json()) as Record<string, unknown[]>)[key]).toEqual([{ id: "r2" }]);
  });
});

describe("single saved flow / round with broken JSON", () => {
  it("GET /api/flows/[clientId] answers a described 422, and a readable flow still loads", async () => {
    await db.insert(savedFlows).values([
      { userId: "u1", clientId: 1, label: "Broken", data: '{"id":1,' },
      { userId: "u1", clientId: 2, label: "Fine", data: '{"id":2,"content":"AC"}' },
    ]);
    const broken = await flowOne.GET(req("/api/flows/1"), { params: Promise.resolve({ clientId: "1" }) });
    expect(broken.status).toBe(422);
    expect(((await broken.json()) as { error: string }).error).toMatch(/saved flow is damaged/);

    const fine = await flowOne.GET(req("/api/flows/2"), { params: Promise.resolve({ clientId: "2" }) });
    expect(fine.status).toBe(200);
    expect(await fine.json()).toEqual({ id: 2, content: "AC" });
  });

  it("GET /api/rounds/[clientId] answers a described 422 for a broken row", async () => {
    await db.insert(savedRounds).values([{ userId: "u1", clientId: 7, label: "Broken", data: "" }]);
    const res = await roundOne.GET(req("/api/rounds/7"), { params: Promise.resolve({ clientId: "7" }) });
    expect(res.status).toBe(422);
    expect(((await res.json()) as { error: string }).error).toMatch(/saved round is damaged/);
  });
});
