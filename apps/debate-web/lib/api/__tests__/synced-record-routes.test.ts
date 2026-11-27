/**
 * @fileoverview The per-record account-sync routes (`/api/learn-decks/[deckId]`,
 * `/api/quick-cards/[cardId]`, `/api/learn-cards/[cardId]` and
 * `/api/coach-materials/[materialId]`) against a real SQLite database: each
 * needs a session, validates the record against the URL, upserts per account,
 * and the card routes refuse to overwrite a newer edit from another device.
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

const decks = await import("@/app/api/learn-decks/[deckId]/route");
const quickCards = await import("@/app/api/quick-cards/[cardId]/route");
const learnCards = await import("@/app/api/learn-cards/[cardId]/route");
const materials = await import("@/app/api/coach-materials/[materialId]/route");

type Handler = (req: NextRequest, ctx: { params: Promise<never> }) => Promise<Response>;

function call(handler: unknown, param: string, key: string, method: string, body?: unknown) {
  const req = new NextRequest(`https://debate-ai.com/api/x/${param}`, {
    method,
    body: body === undefined ? undefined : typeof body === "string" ? body : JSON.stringify(body),
  });
  return (handler as Handler)(req, { params: Promise.resolve({ [key]: param } as never) });
}

async function stored(table: typeof schema.savedLearnDecks, userId: string, clientId: string) {
  const [row] = await db.select().from(table).where(and(eq(table.userId, userId), eq(table.clientId, clientId)));
  return row ? JSON.parse(row.data) : null;
}

beforeEach(async () => {
  signedInAs = "alex";
  db = drizzle(await freshSchemaClient(), { schema });
  const now = new Date();
  await db.insert(schema.user).values(["alex", "sam"].map((id) => ({ id, name: id, email: `${id}@example.com`, createdAt: now, updatedAt: now })));
});

describe("/api/learn-decks/[deckId]", () => {
  const deck = { deckId: "d1", name: "Topicality", cardIds: ["c1"], createdAt: "2026-01-01T00:00:00.000Z" };
  const put = (body: unknown, id = "d1") => call(decks.PUT, id, "deckId", "PUT", body);
  const patch = (body: unknown) => call(decks.PATCH, "d1", "deckId", "PATCH", body);

  it("requires a session for every verb", async () => {
    signedInAs = null;
    expect((await put({ deck })).status).toBe(401);
    expect((await patch({ rename: "x" })).status).toBe(401);
    expect((await call(decks.DELETE, "d1", "deckId", "DELETE")).status).toBe(401);
  });

  it("validates the PUT body and the id against the URL", async () => {
    expect((await put("{nope")).status).toBe(400);
    expect((await put({ deck: { deckId: "d1" } })).status).toBe(400);
    const mismatch = await put({ deck }, "other");
    expect(mismatch.status).toBe(400);
    expect(await mismatch.json()).toEqual({ error: "The deck's id must match the URL's deck id." });
    const huge = await put({ deck: { ...deck, name: "x".repeat(200_001) } });
    expect(huge.status).toBe(413);
  });

  it("upserts a deck for the signed-in account only", async () => {
    expect((await put({ deck })).status).toBe(200);
    expect((await put({ deck: { ...deck, name: "Renamed" } })).status).toBe(200);
    expect(await stored(schema.savedLearnDecks, "alex", "d1")).toMatchObject({ name: "Renamed" });
    expect(await stored(schema.savedLearnDecks, "sam", "d1")).toBeNull();
    expect(await db.select().from(schema.savedLearnDecks)).toHaveLength(1);
  });

  it("applies add, remove and rename patches to the stored deck", async () => {
    expect((await patch({ rename: "x" })).status).toBe(404);
    await put({ deck });

    await patch({ addCardId: "c2" });
    expect((await stored(schema.savedLearnDecks, "alex", "d1")).cardIds).toEqual(["c1", "c2"]);
    await patch({ removeCardId: "c1" });
    expect((await stored(schema.savedLearnDecks, "alex", "d1")).cardIds).toEqual(["c2"]);
    expect((await patch({ rename: "  Kritiks  " })).status).toBe(200);
    expect(await stored(schema.savedLearnDecks, "alex", "d1")).toMatchObject({ name: "Kritiks", cardIds: ["c2"] });
  });

  it("rejects invalid patches", async () => {
    await put({ deck });
    expect((await patch("{nope")).status).toBe(400);
    expect((await patch([])).status).toBe(400);
    expect((await patch({ addCardId: "", })).status).toBe(400);
    expect((await patch({ addCardId: "a", rename: "b" })).status).toBe(400);
    const empty = await patch({});
    expect(await empty.json()).toEqual({ error: 'Provide one of "addCardId", "removeCardId" or "rename".' });
  });

  it("refuses a patch that grows the deck past the size cap", async () => {
    await put({ deck });
    expect((await patch({ addCardId: "x".repeat(200_001) })).status).toBe(413);
  });

  it("deletes only the caller's copy", async () => {
    await put({ deck });
    signedInAs = "sam";
    await put({ deck });
    expect(await (await call(decks.DELETE, "d1", "deckId", "DELETE")).json()).toEqual({ success: true });
    expect(await stored(schema.savedLearnDecks, "sam", "d1")).toBeNull();
    expect(await stored(schema.savedLearnDecks, "alex", "d1")).not.toBeNull();
  });
});

describe.each([
  {
    route: "/api/quick-cards/[cardId]",
    handlers: quickCards,
    key: "cardId",
    field: "card",
    table: schema.savedQuickCards,
    make: (updatedAt: number, front = "a") => ({
      id: "q1", name: front, tags: [], nameLower: front, tagsLower: [], textLower: front, sourceName: "src", createdAt: 1, updatedAt,
    }),
    invalid: { id: "q1" },
    tooBig: (updatedAt: number) => ({ ...({ id: "q1", name: "n", tags: [], nameLower: "n", tagsLower: [], sourceName: "s", createdAt: 1, updatedAt }), textLower: "x".repeat(500_001) }),
  },
  {
    route: "/api/learn-cards/[cardId]",
    handlers: learnCards,
    key: "cardId",
    field: "card",
    table: schema.savedLearnCards,
    make: (updatedAt: number, front = "a") => ({ id: "q1", type: "qa", front, back: "b", updatedAt }),
    invalid: { id: "q1", type: "other" },
    tooBig: (updatedAt: number) => ({ id: "q1", type: "qa", front: "x".repeat(200_001), back: "b", updatedAt }),
  },
])("$route", ({ handlers, key, field, table, make, invalid, tooBig }) => {
  const put = (body: unknown, id = "q1") => call(handlers.PUT, id, key, "PUT", body);

  it("requires a session", async () => {
    signedInAs = null;
    expect((await put({ [field]: make(1) })).status).toBe(401);
    expect((await call(handlers.DELETE, "q1", key, "DELETE")).status).toBe(401);
  });

  it("validates the body, the id and the size", async () => {
    expect((await put("{nope")).status).toBe(400);
    expect((await put({ [field]: invalid })).status).toBe(400);
    expect((await put({ [field]: make(1) }, "other")).status).toBe(400);
    expect((await put({ [field]: tooBig(1) })).status).toBe(413);
  });

  it("upserts per account and keeps the newest edit on a conflict", async () => {
    expect((await put({ [field]: make(100, "first") })).status).toBe(200);
    expect((await put({ [field]: make(200, "second") })).status).toBe(200);
    expect(await stored(table as never, "alex", "q1")).toMatchObject({ updatedAt: 200 });

    const stale = await put({ [field]: make(150, "stale") });
    expect(stale.status).toBe(409);
    expect(await stale.json()).toMatchObject({ current: { updatedAt: 200 } });
    expect(await stored(table as never, "alex", "q1")).toMatchObject({ updatedAt: 200 });

    signedInAs = "sam";
    expect((await put({ [field]: make(1, "sam's") })).status).toBe(200);
    expect(await db.select().from(table)).toHaveLength(2);
  });

  it("deletes only the caller's copy", async () => {
    await put({ [field]: make(1) });
    signedInAs = "sam";
    await put({ [field]: make(1) });
    expect(await (await call(handlers.DELETE, "q1", key, "DELETE")).json()).toEqual({ success: true });
    expect(await stored(table as never, "sam", "q1")).toBeNull();
    expect(await stored(table as never, "alex", "q1")).not.toBeNull();
  });
});

describe("/api/coach-materials/[materialId]", () => {
  const record = { id: "m1", kind: "lecture_transcript", title: "Case neg", tags: ["policy"], text: "Transcript text" };
  const put = (body: unknown, id = "m1") => call(materials.PUT, id, "materialId", "PUT", body);

  it("requires a session", async () => {
    signedInAs = null;
    expect((await put({ record })).status).toBe(401);
    expect((await call(materials.DELETE, "m1", "materialId", "DELETE")).status).toBe(401);
  });

  it("validates the body, the id and the size", async () => {
    expect((await put("{nope")).status).toBe(400);
    expect((await put({ record: { ...record, kind: "gossip" } })).status).toBe(400);
    expect((await put({ record }, "other")).status).toBe(400);
    expect((await put({ record: { ...record, text: "x".repeat(1_000_001) } })).status).toBe(413);
  });

  it("upserts a material and deletes it with its version history", async () => {
    expect((await put({ record })).status).toBe(200);
    expect((await put({ record: { ...record, title: "Edited" } })).status).toBe(200);
    expect(await stored(schema.savedCoachMaterials as never, "alex", "m1")).toMatchObject({ title: "Edited" });

    await db.insert(schema.savedCoachMaterialVersions).values([
      { userId: "alex", clientId: "v1", materialId: "m1", data: "{}" },
      { userId: "alex", clientId: "v2", materialId: "m2", data: "{}" },
    ]);
    expect(await (await call(materials.DELETE, "m1", "materialId", "DELETE")).json()).toEqual({ success: true });
    expect(await db.select().from(schema.savedCoachMaterials)).toEqual([]);
    const versions = await db.select().from(schema.savedCoachMaterialVersions);
    expect(versions.map((v) => v.materialId)).toEqual(["m2"]);
  });
});
