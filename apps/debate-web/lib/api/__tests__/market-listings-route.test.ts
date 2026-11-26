/**
 * @fileoverview `/api/market/listings` against a real SQLite database: the
 * seller's own listing lookup, and listing, repricing and refusing files with
 * the preview outline either supplied or built from the document.
 */

import { NextRequest } from "next/server";
import { drizzle } from "drizzle-orm/libsql";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";

import * as schema from "@/lib/database/schema";
import { freshSchemaClient } from "@/lib/database/__tests__/schema-sql";

let db: ReturnType<typeof drizzle<typeof schema>>;
let signedInAs: string | null = "sam";

vi.mock("@/lib/database/context", () => ({ getDBFromContext: async () => db }));
vi.mock("@/lib/auth/session", () => ({ getUserId: async () => signedInAs }));

const route = await import("@/app/api/market/listings/route");

const get = (query = "") => route.GET(new NextRequest(`https://debate-ai.com/api/market/listings${query}`));
const post = (body: unknown) =>
  route.POST(
    new NextRequest("https://debate-ai.com/api/market/listings", {
      method: "POST",
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
  );

const addDocument = async (userId: string, overrides: Partial<typeof schema.documents.$inferInsert> = {}) => {
  const [row] = await db
    .insert(schema.documents)
    .values({ title: "Aff file", content: "<h1>Aff</h1><h4>Tag one</h4><p>Card text</p>", userId, ...overrides })
    .returning();
  return row.id;
};

describe("/api/market/listings", () => {
  beforeEach(async () => {
    signedInAs = "sam";
    db = drizzle(await freshSchemaClient(), { schema });
    const now = new Date();
    await db.insert(schema.user).values([
      { id: "sam", name: "Sam", email: "sam@example.com", createdAt: now, updatedAt: now },
      { id: "alex", name: "Alex", email: "alex@example.com", createdAt: now, updatedAt: now },
      { id: "guest", name: "Guest", email: "guest@example.com", isAnonymous: true, createdAt: now, updatedAt: now },
    ]);
  });

  describe("GET", () => {
    it("answers null for signed-out callers and unusable document ids", async () => {
      signedInAs = null;
      expect(await (await get("?documentId=1")).json()).toEqual({ listing: null });
      signedInAs = "sam";
      for (const query of ["", "?documentId=abc", "?documentId=0", "?documentId=1.5", "?documentId=-2"]) {
        expect(await (await get(query)).json()).toEqual({ listing: null });
      }
    });

    it("returns the caller's own active listing for a document, and nothing for another seller's", async () => {
      const documentId = await addDocument("sam");
      await post({ documentId, priceCents: 500 });
      const own = await (await get(`?documentId=${documentId}`)).json();
      expect(own.listing).toMatchObject({ priceCents: 500 });
      expect(typeof own.listing.id).toBe("string");

      signedInAs = "alex";
      expect(await (await get(`?documentId=${documentId}`)).json()).toEqual({ listing: null });
    });
  });

  describe("POST", () => {
    it("needs a session and a valid request", async () => {
      signedInAs = null;
      expect((await post({ documentId: 1, priceCents: 500 })).status).toBe(401);
      signedInAs = "sam";
      expect((await post("{nope")).status).toBe(400);
      expect((await post({ documentId: "x", priceCents: 500 })).status).toBe(400);
      expect((await post({ documentId: 1, priceCents: 5 })).status).toBe(400);
      expect((await post({ documentId: 1, priceCents: 500, outline: "nope" })).status).toBe(400);
    });

    it("refuses accounts that are gone and guests", async () => {
      signedInAs = "ghost";
      expect((await post({ documentId: 1, priceCents: 500 })).status).toBe(401);
      signedInAs = "guest";
      const res = await post({ documentId: 1, priceCents: 500 });
      expect(res.status).toBe(403);
      expect(await res.json()).toEqual({ error: "Create an account to sell files." });
    });

    it("lists a file with an outline built from its headings, without leaking its contents", async () => {
      const documentId = await addDocument("sam");
      const res = await post({ documentId, priceCents: 500 });
      expect(res.status).toBe(201);
      const { listing } = await res.json();
      expect(listing).toMatchObject({ title: "Aff file", priceCents: 500, isSeller: true, owned: true });
      expect(listing.content).toBeUndefined();
      expect(listing.outline.map((entry: { text: string }) => entry.text)).toEqual(expect.arrayContaining(["Aff", "Tag one"]));
    });

    it("uses the outline the client supplied, and reprices an existing listing in place", async () => {
      const documentId = await addDocument("sam");
      await post({ documentId, priceCents: 500, outline: [{ level: 1, text: "Custom" }] });
      const again = await post({ documentId, priceCents: 900 });
      expect(again.status).toBe(201);
      expect(await db.select().from(schema.fileListings)).toHaveLength(1);
      expect((await db.select().from(schema.fileListings))[0].priceCents).toBe(900);
    });

    it("leaves the outline empty for an uploaded file in the native format", async () => {
      const documentId = await addDocument("sam", { format: "cmir", content: "native-bytes" });
      const { listing } = await (await post({ documentId, priceCents: 500 })).json();
      expect(listing.outline).toEqual([]);
    });

    it("turns a refused listing into its own status", async () => {
      const others = await addDocument("alex");
      const notYours = await post({ documentId: others, priceCents: 500 });
      expect(notYours.status).toBe(404);
      expect(await notYours.json()).toEqual({ error: "That file isn't one of yours." });

      const folder = await addDocument("sam", { isFolder: true });
      expect((await post({ documentId: folder, priceCents: 500 })).status).toBe(400);
      const empty = await addDocument("sam", { content: "   " });
      expect(await (await post({ documentId: empty, priceCents: 500 })).json()).toEqual({ error: "That file is empty." });
      expect(await db.select().from(schema.fileListings).where(eq(schema.fileListings.sellerId, "sam"))).toEqual([]);
    });
  });
});
