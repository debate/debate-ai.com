/**
 * @fileoverview The admin Topic Starter importer (`POST
 * /api/admin/topic-starters`) against a D1 made before `topic_starter_items`
 * had its `year` column — the production failure where every import died on
 * its first insert ("Failed query: insert into topic_starter_items …") because
 * Drizzle names every schema column and the app ships no migrations. The
 * DOCX → `.cmir` conversion is stubbed; what's under test is the write path.
 */
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as schema from "../../database/schema";
import { topicStarterItems } from "../../database/schema";
import { resetEnsuredColumns } from "../../database/ensure-columns";

const access = vi.hoisted(() => ({ db: null as unknown }));

vi.mock("@/lib/auth/admin", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/auth/admin")>()),
  getAdminAccess: async () => ({ isAdmin: true, email: "admin@example.com" }),
}));
vi.mock("@/lib/database/context", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/database/context")>()),
  getDBFromContext: async () => access.db,
}));
vi.mock("@debate-ai/reason-docs/lib/topic-starters/import", () => ({ docxToStoredCmir: async () => "H4sCMIR" }));
vi.mock("@debate-ai/card-parser", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@debate-ai/card-parser")>()),
  collectDocxEntries: async () => [
    { path: "Neg/Elections DA.docx", bytes: new Uint8Array([1]) },
    { path: "1AC.docx", bytes: new Uint8Array([2]) },
  ],
}));
vi.mock("@/lib/admin/import-log", () => ({ logImportEvent: () => {}, newImportId: () => "imp_test" }));

const { POST } = await import("@/app/api/admin/topic-starters/route");

/** `topic_starter_items` as an older D1 has it: no `year` column. */
async function legacyDb() {
  const client = createClient({ url: ":memory:" });
  await client.execute(`CREATE TABLE "topic_starter_items" (
    "id" integer PRIMARY KEY AUTOINCREMENT NOT NULL,
    "title" text NOT NULL,
    "content" text DEFAULT '' NOT NULL,
    "format" text DEFAULT 'html' NOT NULL,
    "parent_id" integer,
    "is_folder" integer DEFAULT false NOT NULL,
    "tags" text DEFAULT '[]' NOT NULL,
    "published" integer DEFAULT true NOT NULL,
    "created_at" integer DEFAULT (unixepoch()) NOT NULL,
    "updated_at" integer DEFAULT (unixepoch()) NOT NULL
  )`);
  return drizzle(client, { schema });
}

function upload() {
  const form = new FormData();
  form.set("file", new File([new Uint8Array([0x50, 0x4b])], "Kankee Briefs 2026 Nov-Dec - De-extinction Brief.zip"));
  return new NextRequest("http://localhost/api/admin/topic-starters", { method: "POST", body: form });
}

beforeEach(() => {
  resetEnsuredColumns();
});

describe("POST /api/admin/topic-starters", () => {
  it("imports into a database that predates the year column", async () => {
    const db = await legacyDb();
    access.db = db;
    const res = await POST(upload());
    const body = (await res.json()) as { imported: number; error?: string };
    expect(body.error).toBeUndefined();
    expect(res.status).toBe(201);
    expect(body.imported).toBe(2);

    const rows = await db.select().from(topicStarterItems);
    const root = rows.find((r) => r.parentId == null && r.isFolder)!;
    expect(root.title).toBe("Kankee Briefs 2026 Nov-Dec - De-extinction Brief");
    const neg = rows.find((r) => r.title === "Neg")!;
    expect(neg.parentId).toBe(root.id);
    expect(rows.find((r) => r.title === "Elections DA")).toMatchObject({ parentId: neg.id, content: "H4sCMIR", format: "cmir", year: null });
    expect(rows.find((r) => r.title === "1AC")).toMatchObject({ parentId: root.id });
  });
});
