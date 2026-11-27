/**
 * @fileoverview `/api/settings/saved-data/[kind]` against a real SQLite
 * database: unknown and read-only kinds, paging and search limits, exporting
 * one item, and deleting only the caller's own.
 */

import { NextRequest } from "next/server";
import { drizzle } from "drizzle-orm/libsql";
import { beforeEach, describe, expect, it, vi } from "vitest";

import * as schema from "@/lib/database/schema";
import { freshSchemaClient } from "@/lib/database/__tests__/schema-sql";
import { MAX_ITEMS, MAX_QUERY_LENGTH } from "@/lib/saved-data/saved-data-items";

let db: ReturnType<typeof drizzle<typeof schema>>;
let signedInAs: string | null = "alex";

vi.mock("@/lib/database/context", () => ({ getDBFromContext: async () => db }));
vi.mock("@/lib/auth/session", () => ({ getUserId: async () => signedInAs }));

const route = await import("@/app/api/settings/saved-data/[kind]/route");

const url = (kind: string, query = "") => `https://debate-ai.com/api/settings/saved-data/${kind}${query}`;
const get = (kind: string, query = "") =>
  route.GET(new NextRequest(url(kind, query)), { params: Promise.resolve({ kind }) });
const del = (kind: string, query = "") =>
  route.DELETE(new NextRequest(url(kind, query), { method: "DELETE" }), { params: Promise.resolve({ kind }) });

const addDoc = async (userId: string, title: string) =>
  (await db.insert(schema.documents).values({ title, content: `<p>${title}</p>`, userId }).returning())[0].id;

describe("/api/settings/saved-data/[kind]", () => {
  beforeEach(async () => {
    signedInAs = "alex";
    db = drizzle(await freshSchemaClient(), { schema });
    const now = new Date();
    await db.insert(schema.user).values(["alex", "sam"].map((id) => ({ id, name: id, email: `${id}@example.com`, createdAt: now, updatedAt: now })));
  });

  describe("GET", () => {
    it("404s an unknown kind and needs a session", async () => {
      expect((await get("passwords")).status).toBe(404);
      signedInAs = null;
      expect((await get("docs")).status).toBe(401);
    });

    it("lists the caller's items, filtered by search and paged", async () => {
      await addDoc("alex", "Aff case");
      await addDoc("alex", "Neg case");
      await addDoc("sam", "Sam's secret");

      const all = await (await get("docs")).json();
      expect(JSON.stringify(all)).toContain("Aff case");
      expect(JSON.stringify(all)).not.toContain("Sam's secret");

      const filtered = await (await get("docs", "?q=%20neg%20")).json();
      expect(JSON.stringify(filtered)).toContain("Neg case");
      expect(JSON.stringify(filtered)).not.toContain("Aff case");

      const page = await (await get("docs", "?limit=1&offset=1")).json();
      expect(JSON.stringify(page).match(/ case/g)).toHaveLength(1);
    });

    it("rejects a bad page or an over-long search", async () => {
      for (const query of ["?offset=-1", "?offset=1.5", "?limit=0", `?limit=${MAX_ITEMS + 1}`, "?limit=abc"]) {
        expect((await get("docs", query)).status).toBe(400);
      }
      const long = await get("docs", `?q=${"x".repeat(MAX_QUERY_LENGTH + 1)}`);
      expect(long.status).toBe(400);
      expect((await long.json()).error).toContain(`${MAX_QUERY_LENGTH} characters`);
    });

    it("exports one item as a download, and 404s one that is missing or someone else's", async () => {
      const id = await addDoc("alex", "Aff case");
      const file = await get("docs", `?id=${id}`);
      expect(file.status).toBe(200);
      expect(file.headers.get("Content-Type")).toBe("application/json");
      expect(file.headers.get("Content-Disposition")).toMatch(/^attachment; filename="/);
      expect(await file.text()).toContain("Aff case");

      expect((await get("docs", "?id=9999")).status).toBe(404);
      expect((await get("docs", "?id=abc")).status).toBe(400);
      signedInAs = "sam";
      expect((await get("docs", `?id=${id}`)).status).toBe(404);
    });
  });

  describe("DELETE", () => {
    it("404s an unknown kind, refuses read-only kinds with an Allow header, and validates the id", async () => {
      expect((await del("passwords", "?id=1")).status).toBe(404);
      const readOnly = await del("speeches", "?id=1");
      expect(readOnly.status).toBe(405);
      expect(readOnly.headers.get("Allow")).toBe("GET");
      expect((await del("docs", "?id=abc")).status).toBe(400);
    });

    it("needs a session", async () => {
      signedInAs = null;
      expect((await del("docs", "?id=1")).status).toBe(401);
    });

    it("deletes the caller's own item, and never someone else's", async () => {
      const mine = await addDoc("alex", "Mine");
      const theirs = await addDoc("sam", "Theirs");

      expect(await (await del("docs", `?id=${theirs}`)).json()).toEqual({ error: "Saved item not found." });
      expect(await db.select().from(schema.documents)).toHaveLength(2);

      expect(await (await del("docs", `?id=${mine}`)).json()).toEqual({ ok: true });
      expect((await db.select().from(schema.documents)).map((d) => d.title)).toEqual(["Theirs"]);
      expect((await del("docs", `?id=${mine}`)).status).toBe(404);
    });
  });
});
