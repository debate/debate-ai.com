/**
 * @fileoverview `/api/tool-records/[collection]` and its `[recordId]` route
 * against a real SQLite database: only allowlisted collections sync, records
 * are keyed by the collection's id field and private to the account, and an
 * unavailable session answers 503 rather than "signed out".
 */

import { NextRequest } from "next/server";
import { drizzle } from "drizzle-orm/libsql";
import { and, eq } from "drizzle-orm";
import { MAX_TOOL_RECORDS_PER_PUSH } from "@debate-ai/research-evidence/src/account-sync/toolRecordCollections";
import { beforeEach, describe, expect, it, vi } from "vitest";

import * as schema from "@/lib/database/schema";
import { freshSchemaClient } from "@/lib/database/__tests__/schema-sql";

let db: ReturnType<typeof drizzle<typeof schema>>;
let signedInAs: string | null = "alex";
let sessionDown = false;

vi.mock("@/lib/database/context", () => ({ getDBFromContext: async () => db }));
vi.mock("@/lib/auth/session", () => ({
  getUserIdOrUnavailable: async () => {
    if (sessionDown) {
      const error = new Error("Could not look up the session; try again shortly.");
      error.name = "SessionUnavailableError";
      throw error;
    }
    return signedInAs;
  },
}));

const collectionRoute = await import("@/app/api/tool-records/[collection]/route");
const recordRoute = await import("@/app/api/tool-records/[collection]/[recordId]/route");

const COLLECTION = "practiceRounds";
const url = "https://debate-ai.com/api/tool-records";
const body = (value: unknown) => (typeof value === "string" ? value : JSON.stringify(value));

const collection = (method: "GET" | "PUT" | "DELETE", key: string, payload?: unknown) =>
  collectionRoute[method](
    new NextRequest(`${url}/${key}`, { method, body: payload === undefined ? undefined : body(payload) }),
    { params: Promise.resolve({ collection: key }) },
  );
const record = (method: "PUT" | "DELETE", key: string, recordId: string, payload?: unknown) =>
  recordRoute[method](
    new NextRequest(`${url}/${key}/${recordId}`, { method, body: payload === undefined ? undefined : body(payload) }),
    { params: Promise.resolve({ collection: key, recordId }) },
  );
const rows = (userId?: string) =>
  userId
    ? db.select().from(schema.savedToolRecords).where(eq(schema.savedToolRecords.userId, userId))
    : db.select().from(schema.savedToolRecords);

describe("/api/tool-records", () => {
  beforeEach(async () => {
    signedInAs = "alex";
    sessionDown = false;
    db = drizzle(await freshSchemaClient(), { schema });
    const now = new Date();
    await db.insert(schema.user).values(["alex", "sam"].map((id) => ({ id, name: id, email: `${id}@example.com`, createdAt: now, updatedAt: now })));
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  describe("[collection]", () => {
    it("only syncs allowlisted collections", async () => {
      for (const method of ["GET", "PUT", "DELETE"] as const) {
        const res = await collection(method, "madeUp", method === "PUT" ? { records: [] } : undefined);
        expect(res.status).toBe(404);
        expect(await res.json()).toEqual({ error: 'Nothing syncs under "madeUp".' });
      }
    });

    it("answers 401 when signed out and 503 when the session lookup is down", async () => {
      signedInAs = null;
      expect((await collection("GET", COLLECTION)).status).toBe(401);
      expect((await collection("PUT", COLLECTION, { records: [] })).status).toBe(401);
      expect((await collection("DELETE", COLLECTION)).status).toBe(401);
      sessionDown = true;
      expect((await collection("GET", COLLECTION)).status).toBe(503);
    });

    it("validates a push", async () => {
      expect((await collection("PUT", COLLECTION, "{nope")).status).toBe(400);
      expect((await collection("PUT", COLLECTION, { records: "x" })).status).toBe(400);
      const missingId = await collection("PUT", COLLECTION, { records: [{ roundId: "r1" }, { title: "no id" }] });
      expect(missingId.status).toBe(400);
      expect(await missingId.json()).toEqual({ error: 'Every record needs a "roundId" to sync under.' });
      const tooMany = await collection("PUT", COLLECTION, {
        records: Array.from({ length: MAX_TOOL_RECORDS_PER_PUSH + 1 }, (_, i) => ({ roundId: `r${i}` })),
      });
      expect(tooMany.status).toBe(413);
      expect((await collection("PUT", COLLECTION, { records: [{ roundId: "r1", notes: "x".repeat(200_001) }] })).status).toBe(413);
      expect(await rows()).toEqual([]);
    });

    it("upserts records by id, dropping duplicates within a push, and lists them back", async () => {
      const first = await collection("PUT", COLLECTION, {
        records: [{ roundId: "r1", score: 1 }, { roundId: "r2", score: 2 }, { roundId: "r1", score: 99 }],
      });
      expect(await first.json()).toMatchObject({ collection: COLLECTION, saved: 2 });

      await collection("PUT", COLLECTION, { records: [{ roundId: "r1", score: 3 }] });
      const listed = await (await collection("GET", COLLECTION)).json();
      expect(listed).toHaveLength(2);
      expect(listed).toEqual(expect.arrayContaining([{ roundId: "r1", score: 3 }, { roundId: "r2", score: 2 }]));
    });

    it("keeps accounts and collections apart, and deletes one collection for one account", async () => {
      await collection("PUT", COLLECTION, { records: [{ roundId: "r1" }] });
      await collection("PUT", "preRoundBriefings", { records: [{ roundId: "b1" }] });
      signedInAs = "sam";
      await collection("PUT", COLLECTION, { records: [{ roundId: "r1" }] });
      expect(await (await collection("GET", "preRoundBriefings")).json()).toEqual([]);

      signedInAs = "alex";
      expect(await (await collection("DELETE", COLLECTION)).json()).toEqual({ success: true });
      expect(await (await collection("GET", COLLECTION)).json()).toEqual([]);
      expect(await (await collection("GET", "preRoundBriefings")).json()).toHaveLength(1);
      expect(await rows("sam")).toHaveLength(1);
    });
  });

  describe("[collection]/[recordId]", () => {
    it("only syncs allowlisted collections and needs a session", async () => {
      expect((await record("PUT", "madeUp", "r1", { record: {} })).status).toBe(404);
      expect((await record("DELETE", "madeUp", "r1")).status).toBe(404);
      signedInAs = null;
      expect((await record("PUT", COLLECTION, "r1", { record: { roundId: "r1" } })).status).toBe(401);
      expect((await record("DELETE", COLLECTION, "r1")).status).toBe(401);
    });

    it("validates the record against the URL and the size cap", async () => {
      expect((await record("PUT", COLLECTION, "r1", "{nope")).status).toBe(400);
      expect((await record("PUT", COLLECTION, "r1", { record: { title: "no id" } })).status).toBe(400);
      const mismatch = await record("PUT", COLLECTION, "r1", { record: { roundId: "r2" } });
      expect(mismatch.status).toBe(400);
      expect(await mismatch.json()).toEqual({ error: `The record's "roundId" must match the URL's record id.` });
      expect((await record("PUT", COLLECTION, "r1", { record: { roundId: "r1", notes: "x".repeat(200_001) } })).status).toBe(413);
    });

    it("upserts and deletes a single record without touching its neighbours", async () => {
      await collection("PUT", COLLECTION, { records: [{ roundId: "r2", score: 2 }] });
      expect((await record("PUT", COLLECTION, "r1", { record: { roundId: "r1", score: 1 } })).status).toBe(200);
      const saved = await record("PUT", COLLECTION, "r1", { record: { roundId: "r1", score: 5 } });
      expect(await saved.json()).toMatchObject({ collection: COLLECTION, recordId: "r1" });

      const [stored] = await db
        .select()
        .from(schema.savedToolRecords)
        .where(and(eq(schema.savedToolRecords.userId, "alex"), eq(schema.savedToolRecords.clientId, "r1")));
      expect(JSON.parse(stored.data)).toEqual({ roundId: "r1", score: 5 });

      expect(await (await record("DELETE", COLLECTION, "r1")).json()).toEqual({ success: true });
      const left = await rows("alex");
      expect(left.map((r) => r.clientId)).toEqual(["r2"]);
    });
  });
});
