/**
 * @fileoverview `/api/flow-sync` against a real SQLite database: collaborators
 * push box edits and pull the ones after a timestamp, oldest first, per flow.
 */

import { NextRequest } from "next/server";
import { drizzle } from "drizzle-orm/libsql";
import { beforeEach, describe, expect, it, vi } from "vitest";

import * as schema from "@/lib/database/schema";
import { freshSchemaClient } from "@/lib/database/__tests__/schema-sql";

let db: ReturnType<typeof drizzle<typeof schema>>;

vi.mock("@/lib/database/context", () => ({ getDBFromContext: async () => db }));

const route = await import("@/app/api/flow-sync/route");

const url = "https://debate-ai.com/api/flow-sync";
const push = (body: unknown) =>
  route.POST(new NextRequest(url, { method: "POST", body: typeof body === "string" ? body : JSON.stringify(body) }));
const pull = (query: string) => route.GET(new NextRequest(`${url}?${query}`));
const edit = (overrides: Record<string, unknown> = {}) => ({
  id: "e1",
  flowId: 7,
  boxPath: [0, 2],
  authorId: "alex",
  content: "Extend inherency",
  timestampMs: 1000,
  ...overrides,
});

describe("/api/flow-sync", () => {
  beforeEach(async () => {
    db = drizzle(await freshSchemaClient(), { schema });
  });

  it("names the first thing wrong with a pushed edit", async () => {
    expect((await push("{nope")).status).toBe(400);
    const cases: [Record<string, unknown>, string][] = [
      [{ id: "  " }, "id is required."],
      [{ flowId: 1.5 }, "flowId must be a whole number."],
      [{ authorId: "" }, "authorId is required."],
      [{ boxPath: [] }, "boxPath must be a non-empty array of numbers."],
      [{ boxPath: ["a"] }, "boxPath must be a non-empty array of numbers."],
      [{ timestampMs: "soon" }, "timestampMs must be a number."],
    ];
    for (const [overrides, error] of cases) {
      const res = await push(edit(overrides));
      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error });
    }
  });

  it("stores an edit, truncating overlong content, and echoes it back", async () => {
    const res = await push(edit({ id: " e1 ", content: "x".repeat(2500) }));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body).toMatchObject({ id: "e1", flowId: 7, boxPath: [0, 2], authorId: "alex" });
    expect(body.content).toHaveLength(2000);
    expect(await db.select().from(schema.flowSyncEdits)).toHaveLength(1);
  });

  it("treats a missing content field as an empty edit and upserts by id", async () => {
    await push(edit({ content: undefined }));
    await push(edit({ content: "Revised", timestampMs: 2000 }));
    const rows = await db.select().from(schema.flowSyncEdits);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ content: "Revised", timestampMs: 2000 });
  });

  it("validates the pull query", async () => {
    expect((await pull("")).status).toBe(400);
    expect((await pull("flowId=abc")).status).toBe(400);
    expect((await pull("flowId=1.5")).status).toBe(400);
    expect(await (await pull("flowId=1&sinceMs=soon")).json()).toEqual({ error: "sinceMs must be a number." });
  });

  it("pulls one flow's edits after a timestamp, oldest first", async () => {
    await push(edit({ id: "late", timestampMs: 3000, boxPath: [1] }));
    await push(edit({ id: "early", timestampMs: 1000 }));
    await push(edit({ id: "other-flow", flowId: 8, timestampMs: 2000 }));

    const all = await (await pull("flowId=7")).json();
    expect(all.edits.map((e: { id: string }) => e.id)).toEqual(["early", "late"]);
    expect(all.edits[1].boxPath).toEqual([1]);

    const since = await (await pull("flowId=7&sinceMs=1000")).json();
    expect(since.edits.map((e: { id: string }) => e.id)).toEqual(["late"]);
    expect((await (await pull("flowId=7&sinceMs=")).json()).edits).toHaveLength(2);
  });

  it("serves an empty box path for a row whose stored path is damaged", async () => {
    await db.insert(schema.flowSyncEdits).values([
      { id: "bad-json", flowId: 7, boxPath: "{nope", authorId: "a", content: "", timestampMs: 1 },
      { id: "bad-shape", flowId: 7, boxPath: '["x"]', authorId: "a", content: "", timestampMs: 2 },
    ]);
    const { edits } = await (await pull("flowId=7")).json();
    expect(edits.map((e: { boxPath: number[] }) => e.boxPath)).toEqual([[], []]);
  });
});
