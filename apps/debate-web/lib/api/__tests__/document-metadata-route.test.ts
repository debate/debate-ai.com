/**
 * @fileoverview `/api/doc/documents/[id]/metadata` against a real SQLite
 * database: a file's publication details are the owner's alone to read or
 * edit, folders have none, the body is validated before anything is written,
 * and a file can only be published under a publisher its owner runs.
 */

import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { freshSchemaDb } from "@/lib/database/__tests__/schema-sql";
import * as schema from "@/lib/database/schema";
import { createPublisher } from "@/lib/market/publishers";

type Db = Awaited<ReturnType<typeof freshSchemaDb>>;

let db: Db;
let signedInAs: string | null = null;

vi.mock("@/lib/database/context", () => ({ getDBFromContext: async () => db, getCloudflareContext: () => undefined }));
vi.mock("@/lib/auth/session", () => ({ getUserId: async () => signedInAs }));

const route = await import("@/app/api/doc/documents/[id]/metadata/route");

type Handler = (request: NextRequest, context: { params: Promise<{ id: string }> }) => Promise<Response>;
const get = (id: number | string) =>
  (route.GET as unknown as Handler)(new NextRequest("https://debate-ai.com/x"), { params: Promise.resolve({ id: String(id) }) });
const put = (id: number | string, body: unknown) =>
  (route.PUT as unknown as Handler)(
    new NextRequest("https://debate-ai.com/x", { method: "PUT", body: typeof body === "string" ? body : JSON.stringify(body) }),
    { params: Promise.resolve({ id: String(id) }) },
  );

async function addUser(id: string) {
  const now = new Date();
  await db.insert(schema.user).values({ id, name: id, email: `${id}@example.com`, createdAt: now, updatedAt: now });
}

async function addDocument(userId: string | null, extra: Partial<typeof schema.documents.$inferInsert> = {}) {
  const [row] = await db.insert(schema.documents).values({ title: "Case", userId, ...extra }).returning({ id: schema.documents.id });
  return row.id;
}

const request = (name: string) => ({ name, description: "", researchGroup: "", students: [], years: "", website: "", priceCents: 0 });

beforeEach(async () => {
  db = await freshSchemaDb();
  signedInAs = null;
  vi.spyOn(console, "error").mockImplementation(() => {});
  await addUser("alex");
  await addUser("sam");
});

describe("GET /api/doc/documents/[id]/metadata", () => {
  it("404s for a document that does not exist", async () => {
    signedInAs = "alex";
    expect((await get(999)).status).toBe(404);
  });

  it("is the owner's alone, and folders have no details", async () => {
    const mine = await addDocument("alex");
    const folder = await addDocument("alex", { isFolder: true });
    signedInAs = "sam";
    expect((await get(mine)).status).toBe(403);
    signedInAs = "alex";
    const res = await get(folder);
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Folders have no details." });
  });

  it("returns empty details with the owner's publishers for a fresh file", async () => {
    const id = await addDocument("alex", { author: "Alex A." });
    const publisher = await createPublisher(db, "alex", request("Alex Research"));
    await createPublisher(db, "sam", request("Sam Research"));
    signedInAs = "alex";

    const body = await (await get(id)).json();
    expect(body.metadata).toEqual({
      author: "Alex A.",
      publisherId: null,
      researchGroup: "",
      students: [],
      years: "",
      publishedOn: "",
      summary: "",
    });
    expect(body.publisher).toBeNull();
    expect(body.canEdit).toBe(true);
    expect(body.ownPublishers.map((p: { id: string }) => p.id)).toEqual([publisher.id]);
  });

  it("lets anyone read an unowned document, but not edit it", async () => {
    const id = await addDocument(null);
    signedInAs = null;
    const body = await (await get(id)).json();
    expect(body).toMatchObject({ canEdit: false, ownPublishers: [] });
  });
});

describe("PUT /api/doc/documents/[id]/metadata", () => {
  it("needs a session, ownership and a real file", async () => {
    const id = await addDocument("alex");
    expect((await put(id, {})).status).toBe(401);
    signedInAs = "sam";
    expect((await put(id, {})).status).toBe(403);
    signedInAs = "alex";
    expect((await put(999, {})).status).toBe(404);
    expect((await put(await addDocument("alex", { isFolder: true }), {})).status).toBe(400);
  });

  it("rejects unparseable JSON, a bad date and a non-string publisher without writing", async () => {
    const id = await addDocument("alex", { author: "Keep me" });
    signedInAs = "alex";
    expect(await (await put(id, "{nope")).json()).toEqual({ error: "Invalid JSON body." });
    expect((await put(id, { publishedOn: "2025-02-30" })).status).toBe(400);
    expect((await put(id, { publishedOn: "yesterday" })).status).toBe(400);
    expect((await put(id, { publisherId: 7 })).status).toBe(400);
    expect((await put(id, "null")).status).toBe(400);
    expect((await db.select().from(schema.documents))[0].author).toBe("Keep me");
    expect(await db.select().from(schema.documentMetadata)).toEqual([]);
  });

  it("saves the details, updates them in place, and sets the file's author", async () => {
    const id = await addDocument("alex");
    const publisher = await createPublisher(db, "alex", request("Alex Research"));
    signedInAs = "alex";

    const saved = await (
      await put(id, {
        author: "  Alex A.  ",
        publisherId: publisher.id,
        researchGroup: "Lab",
        students: ["Ann", "  ", "Bob"],
        years: "2025-26",
        publishedOn: "2025-09-01",
        summary: "Politics DA",
      })
    ).json();
    expect(saved.metadata).toMatchObject({
      author: "Alex A.",
      publisherId: publisher.id,
      researchGroup: "Lab",
      years: "2025-26",
      publishedOn: "2025-09-01",
      summary: "Politics DA",
    });
    expect(saved.metadata.students).toEqual(["Ann", "Bob"]);
    expect(saved.publisher).toMatchObject({ id: publisher.id, name: "Alex Research" });

    const again = await (await put(id, { summary: "Updated" })).json();
    expect(again.metadata).toMatchObject({ summary: "Updated", publisherId: null, author: "" });
    expect(await db.select().from(schema.documentMetadata)).toHaveLength(1);
    expect((await db.select().from(schema.documents))[0].author).toBeNull();
  });

  it("refuses to publish under a publisher someone else runs", async () => {
    const id = await addDocument("alex");
    const theirs = await createPublisher(db, "sam", request("Sam Research"));
    signedInAs = "alex";
    const res = await put(id, { publisherId: theirs.id });
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: "You can only publish under a publisher you run." });
    expect(await db.select().from(schema.documentMetadata)).toEqual([]);
  });
});
