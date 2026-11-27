/**
 * @fileoverview `/api/flows/[clientId]` and `/api/rounds/[clientId]` against a
 * real SQLite database: a saved flow or round is private to its account, saves
 * go through optimistic-concurrency checks, and a damaged row is reported
 * rather than served.
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

const flows = await import("@/app/api/flows/[clientId]/route");
const rounds = await import("@/app/api/rounds/[clientId]/route");

type Handler = (req: NextRequest, ctx: { params: Promise<{ clientId: string }> }) => Promise<Response>;
const send = (handler: unknown, id: string | number, method: string, body?: unknown) =>
  (handler as Handler)(
    new NextRequest(`https://debate-ai.com/api/x/${id}`, {
      method,
      body: body === undefined ? undefined : typeof body === "string" ? body : JSON.stringify(body),
    }),
    { params: Promise.resolve({ clientId: String(id) }) },
  );

beforeEach(async () => {
  signedInAs = "alex";
  db = drizzle(await freshSchemaClient(), { schema });
  const now = new Date();
  await db.insert(schema.user).values(["alex", "sam"].map((id) => ({ id, name: id, email: `${id}@example.com`, createdAt: now, updatedAt: now })));
});

const flow = (id: number, content = "Contention 1") => ({
  id, content, level: 0, columns: ["1AC"], invert: false, focus: false, index: 0, lastFocus: [], children: [],
});
const round = (id: number, extra: Record<string, unknown> = {}) => ({
  id,
  tournamentName: "Nationals",
  roundLevel: "Finals",
  debaters: { aff: ["A", "B"], neg: ["C", "D"] },
  judges: ["J"],
  flowIds: [],
  timestamp: 1,
  status: "completed",
  ...extra,
});

describe.each([
  {
    name: "/api/flows/[clientId]",
    handlers: flows,
    field: "flow",
    table: schema.savedFlows,
    make: (id: number, content?: string) => flow(id, content),
    label: (content: string) => content,
    invalid: { id: 1, content: 5 },
    huge: () => flow(1, "x".repeat(2_000_001)),
    damaged: "damaged flow",
  },
  {
    name: "/api/rounds/[clientId]",
    handlers: rounds,
    field: "round",
    table: schema.savedRounds,
    make: (id: number, title?: string) => round(id, title ? { title } : {}),
    label: (title: string) => title,
    invalid: { id: 1 },
    huge: () => round(1, { title: "x".repeat(2_000_001) }),
    damaged: "damaged round",
  },
])("$name", ({ handlers, field, table, make, invalid, huge, damaged }) => {
  const put = (id: number | string, body: unknown) => send(handlers.PUT, id, "PUT", body);
  const get = (id: number | string) => send(handlers.GET, id, "GET");
  const rowOf = async (userId: string, clientId: number) =>
    (await db.select().from(table).where(and(eq(table.userId, userId), eq(table.clientId, clientId))))[0];

  it("rejects non-integer ids before anything else", async () => {
    signedInAs = null;
    for (const method of ["GET", "PUT", "DELETE"] as const) {
      expect((await send(handlers[method], "abc", method)).status).toBe(400);
      expect((await send(handlers[method], "1.5", method)).status).toBe(400);
    }
  });

  it("requires a session for every verb", async () => {
    signedInAs = null;
    expect((await get(1)).status).toBe(401);
    expect((await put(1, { [field]: make(1) })).status).toBe(401);
    expect((await send(handlers.DELETE, 1, "DELETE")).status).toBe(401);
  });

  it("validates the body, the id and the size of a save", async () => {
    expect((await put(1, "{nope")).status).toBe(400);
    expect((await put(1, null)).status).toBe(400);
    expect((await put(1, { [field]: invalid })).status).toBe(400);
    const mismatch = await put(2, { [field]: make(1) });
    expect(mismatch.status).toBe(400);
    expect((await mismatch.json()).error).toContain("must match the URL");
    expect((await put(1, { [field]: huge() })).status).toBe(413);
  });

  it("saves a new record, loads it back and keeps accounts apart", async () => {
    const saved = await (await put(1, { [field]: make(1, "Opening") })).json();
    expect(saved).toMatchObject({ clientId: 1, label: expect.stringContaining("Opening") });

    expect(await (await get(1)).json()).toMatchObject({ id: 1 });
    signedInAs = "sam";
    expect((await get(1)).status).toBe(404);
  });

  it("derives a fallback label when the record has no title", async () => {
    const { label } = await (await put(1, { [field]: make(1) })).json();
    expect(label.length).toBeGreaterThan(0);
  });

  it("refuses to overwrite a version the caller has not seen, unless forced", async () => {
    await put(1, { [field]: make(1, "v1") });

    const blind = await put(1, { [field]: make(1, "v2") });
    expect(blind.status).toBe(409);
    expect(await blind.json()).toMatchObject({ current: { clientId: 1 } });

    const stale = await put(1, { [field]: make(1, "v2"), baseUpdatedAt: "2000-01-01T00:00:00.000Z" });
    expect(stale.status).toBe(409);

    const base = (await rowOf("alex", 1)).updatedAt.toISOString();
    expect((await put(1, { [field]: make(1, "v2"), baseUpdatedAt: base })).status).toBe(200);
    expect(JSON.parse((await rowOf("alex", 1)).data)).toMatchObject({ id: 1 });

    expect((await put(1, { [field]: make(1, "v3"), force: true })).status).toBe(200);
    expect(await db.select().from(table)).toHaveLength(1);
  });

  it("reports a damaged row instead of serving it", async () => {
    await db.insert(table).values({ userId: "alex", clientId: 9, label: damaged, data: "{not json" });
    const res = await get(9);
    expect(res.status).toBe(422);
    expect((await res.json()).error).toContain("damaged");
  });

  it("deletes only the caller's copy", async () => {
    await put(1, { [field]: make(1) });
    signedInAs = "sam";
    await put(1, { [field]: make(1) });
    expect(await (await send(handlers.DELETE, 1, "DELETE")).json()).toEqual({ success: true });
    expect(await rowOf("sam", 1)).toBeUndefined();
    expect(await rowOf("alex", 1)).toBeDefined();
  });
});
