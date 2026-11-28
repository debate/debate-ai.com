/**
 * @fileoverview The remaining id-keyed account-sync routes (custom opponent
 * personas, Daily Best Card comments, speech-document send log, scheduled
 * sprint sessions), against a real SQLite database: PUT validates the record
 * against the URL and upserts per account, DELETE removes only the caller's
 * copy. Companion to `synced-records-by-id-routes.test.ts`.
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
vi.mock("@/lib/auth/session", () => ({ getUserId: async () => signedInAs }));

const personas = await import("@/app/api/custom-opponent-personas/[id]/route");
const comments = await import("@/app/api/daily-best-card-comments/[commentId]/route");
const sendLog = await import("@/app/api/speech-send-log/[entryId]/route");
const sprints = await import("@/app/api/sprint-sessions/[sessionId]/route");

type Handler = (req: NextRequest, ctx: { params: Promise<Record<string, string>> }) => Promise<Response>;
const call = (handler: unknown, key: string, id: string, method: string, body?: unknown) =>
  (handler as Handler)(
    new NextRequest(`https://debate-ai.com/api/x/${id}`, {
      method,
      body: body === undefined ? undefined : typeof body === "string" ? body : JSON.stringify(body),
    }),
    { params: Promise.resolve({ [key]: id }) },
  );

beforeEach(async () => {
  signedInAs = "alex";
  db = drizzle(await freshSchemaClient(), { schema });
  const now = new Date();
  await db.insert(schema.user).values(["alex", "sam"].map((id) => ({ id, name: id, email: `${id}@example.com`, createdAt: now, updatedAt: now })));
});

describe.each([
  {
    route: "/api/custom-opponent-personas/[id]",
    handlers: personas,
    key: "id",
    bodyKey: "entry",
    table: schema.savedCustomOpponentPersonas,
    make: (id: string, extra: Record<string, unknown> = {}) => ({
      id, name: "Hard-nosed policy judge", notes: "Hates spreading", shared: false, createdAt: 1, updatedAt: 1, ...extra,
    }),
    invalid: (id: string) => ({ id, name: "   ", notes: "x", shared: false, createdAt: 1, updatedAt: 1 }),
    huge: (id: string) => ({ id, name: "x", notes: "y".repeat(20_001), shared: false, createdAt: 1, updatedAt: 1 }),
  },
  {
    route: "/api/daily-best-card-comments/[commentId]",
    handlers: comments,
    key: "commentId",
    bodyKey: "comment",
    table: schema.savedDailyBestCardComments,
    make: (id: string, extra: Record<string, unknown> = {}) => ({
      id, dayKey: "2026-05-01", authorId: "alex", text: "Great card", postedAt: 1, ...extra,
    }),
    invalid: (id: string) => ({ id, dayKey: "May 1", authorId: "alex", text: "Great card", postedAt: 1 }),
    huge: (id: string) => ({ id, dayKey: "2026-05-01", authorId: "alex", text: "x".repeat(20_001), postedAt: 1 }),
    hugeStatus: 400,
  },
  {
    route: "/api/speech-send-log/[entryId]",
    handlers: sendLog,
    key: "entryId",
    bodyKey: "entry",
    table: schema.savedSpeechSendLog,
    make: (id: string, extra: Record<string, unknown> = {}) => ({
      id, text: "Insert this card", preview: "Insert this card", atEnd: true, sentAt: 1, ...extra,
    }),
    invalid: (id: string) => ({ id, text: "Insert this card", preview: "Insert", atEnd: "yes", sentAt: 1 }),
    huge: (id: string) => ({ id, text: "x".repeat(200_001), preview: "x", atEnd: false, sentAt: 1 }),
  },
  {
    route: "/api/sprint-sessions/[sessionId]",
    handlers: sprints,
    key: "sessionId",
    bodyKey: "session",
    table: schema.savedSprintSessions,
    make: (id: string, extra: Record<string, unknown> = {}) => ({
      id, topic: "Space", title: "Morning sprint", scheduledDayKey: "2026-05-01", createdAt: 1, ...extra,
    }),
    invalid: (id: string) => ({ id, topic: "Space", title: "Morning sprint", scheduledDayKey: "tomorrow", createdAt: 1 }),
    huge: (id: string) => ({ id, topic: "t".repeat(5_001), title: "Morning sprint", scheduledDayKey: "2026-05-01", createdAt: 1 }),
  },
])("$route", ({ handlers, key, bodyKey, table, make, invalid, huge, hugeStatus = 413 }) => {
  const body = (value: unknown) => ({ [bodyKey]: value });
  const put = (id: string, payload: unknown) => call(handlers.PUT, key, id, "PUT", payload);
  const del = (id: string) => call(handlers.DELETE, key, id, "DELETE");
  const rowOf = async (userId: string, id: string) =>
    (await db.select().from(table).where(and(eq(table.userId, userId), eq(table.clientId, id))))[0];

  it("requires a session", async () => {
    signedInAs = null;
    expect((await put("r1", body(make("r1")))).status).toBe(401);
    expect((await del("r1")).status).toBe(401);
  });

  it("validates the body, the record, the id and the size", async () => {
    expect((await put("r1", "{nope")).status).toBe(400);
    expect((await put("r1", null)).status).toBe(400);
    expect((await put("r1", {})).status).toBe(400);
    expect((await put("r1", body(invalid("r1")))).status).toBe(400);
    const mismatch = await put("r1", body(make("r2")));
    expect(mismatch.status).toBe(400);
    expect((await mismatch.json()).error).toMatch(/must match the URL/);
    expect(await db.select().from(table)).toEqual([]);
  });

  it("refuses an oversized record", async () => {
    expect((await put("r1", body(huge("r1")))).status).toBe(hugeStatus);
    expect(await db.select().from(table)).toEqual([]);
  });

  it("upserts the record for the caller only", async () => {
    const first = await put("r1", body(make("r1")));
    expect(await first.json()).toMatchObject({ updatedAt: expect.any(String) });
    expect((await put("r1", body(make("r1", { edited: true })))).status).toBe(200);

    expect(JSON.parse((await rowOf("alex", "r1")).data)).toMatchObject({ id: "r1", edited: true });
    expect(await rowOf("sam", "r1")).toBeUndefined();
    expect(await db.select().from(table)).toHaveLength(1);
  });

  it("deletes only the caller's copy", async () => {
    await put("r1", body(make("r1")));
    signedInAs = "sam";
    await put("r1", body(make("r1")));
    expect(await (await del("r1")).json()).toEqual({ success: true });
    expect(await rowOf("sam", "r1")).toBeUndefined();
    expect(await rowOf("alex", "r1")).toBeDefined();
  });
});

describe("denormalised columns", () => {
  it("writes a persona's shared flag to its own column, and updates it on re-save", async () => {
    const persona = { id: "p1", name: "Judge", notes: "Notes", shared: true, createdAt: 1, updatedAt: 1 };
    await call(personas.PUT, "id", "p1", "PUT", { entry: persona });
    expect((await db.select().from(schema.savedCustomOpponentPersonas))[0].shared).toBe(true);
    await call(personas.PUT, "id", "p1", "PUT", { entry: { ...persona, shared: false } });
    expect((await db.select().from(schema.savedCustomOpponentPersonas))[0].shared).toBe(false);
  });

  it("stores a comment's day and a sprint session's topic for filtering", async () => {
    await call(comments.PUT, "commentId", "c1", "PUT", {
      comment: { id: "c1", dayKey: "2026-05-01", authorId: "alex", text: "Nice", postedAt: 1 },
    });
    expect((await db.select().from(schema.savedDailyBestCardComments))[0].dayKey).toBe("2026-05-01");

    const session = { id: "s1", topic: "Space", title: "Sprint", scheduledDayKey: "2026-05-02", createdAt: 1 };
    await call(sprints.PUT, "sessionId", "s1", "PUT", { session });
    await call(sprints.PUT, "sessionId", "s1", "PUT", { session: { ...session, topic: "Oceans" } });
    expect((await db.select().from(schema.savedSprintSessions))[0].topic).toBe("Oceans");
  });
});
