/**
 * @fileoverview The openCaselist → Topic Starters sync: the ZIP is uploaded
 * to R2 before any conversion, and the background pass reads it back out of
 * the bucket with Range requests, converts each `.docx` to `.cmir` and files
 * it under the chosen topic. The DOCX → `.cmir` conversion is stubbed; what's
 * under test is the two-step job and the row writes.
 */
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import JSZip from "jszip";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as schema from "../../database/schema";
import { topicStarterItems } from "../../database/schema";

const mocks = vi.hoisted(() => ({
  db: null as unknown,
  bucket: null as unknown,
  downloads: vi.fn(),
  fetch: vi.fn(),
}));

vi.mock("@/lib/auth/admin", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/auth/admin")>()),
  getAdminAccess: async () => ({ isAdmin: true, email: "admin@example.com" }),
}));
vi.mock("@/lib/database/context", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/database/context")>()),
  getDBFromContext: async () => mocks.db,
}));
vi.mock("@/lib/caselist/team-caselist", () => ({ caselistCredentials: () => ({ token: "token" }) }));
vi.mock("@/lib/search/card-text-store", () => ({ getCardTextBucket: () => mocks.bucket }));
vi.mock("@/lib/topic-starters/file-index", () => ({ refreshTopicStarterFileIndexQuietly: async () => {} }));
vi.mock("@/lib/file-stats/columns", () => ({ fileStatColumns: async () => ({ quoteCount: 1, blockCount: 1, pageCount: 1, charCount: 1 }) }));
vi.mock("@/lib/admin/import-log", () => ({ logImportEvent: () => {}, newImportId: () => "imp_test" }));
vi.mock("@debate-ai/reason-docs/lib/topic-starters/import", () => ({ docxToStoredCmir: vi.fn(async () => "H4sCMIR") }));
vi.mock("@debate-ai/research-evidence/src/caselist", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@debate-ai/research-evidence/src/caselist")>();
  return { ...actual, fetchCaselistDownloads: mocks.downloads };
});

const { startTopicStarterSync, processTopicStarterImport, getTopicStarterImport } = await import("../sync");

/** An in-memory R2 stand-in that supports the Range reads `openRemoteZip` needs. */
class FakeBucket {
  readonly objects = new Map<string, Uint8Array>();

  async put(key: string, value: unknown) {
    if (value instanceof ReadableStream) {
      this.objects.set(key, new Uint8Array(await new Response(value).arrayBuffer()));
      return;
    }
    if (value instanceof Uint8Array) {
      this.objects.set(key, value);
      return;
    }
    this.objects.set(key, new TextEncoder().encode(String(value)));
  }

  async head(key: string) {
    const bytes = this.objects.get(key);
    return bytes ? { size: bytes.byteLength } : null;
  }

  async get(key: string, options?: { range?: { offset: number; length?: number } }) {
    const bytes = this.objects.get(key);
    if (!bytes) return null;
    const start = options?.range?.offset ?? 0;
    const end = options?.range?.length === undefined ? bytes.byteLength : start + options.range.length;
    const slice = bytes.slice(start, end);
    return {
      text: async () => new TextDecoder().decode(slice),
      arrayBuffer: async () => slice.buffer.slice(slice.byteOffset, slice.byteOffset + slice.byteLength) as ArrayBuffer,
    };
  }

  async delete(key: string) {
    this.objects.delete(key);
  }
}

async function database() {
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
    "year" integer,
    "topic_code" text,
    "author" text,
    "quote_count" integer,
    "block_count" integer,
    "page_count" integer,
    "char_count" integer,
    "created_at" integer DEFAULT (unixepoch()) NOT NULL,
    "updated_at" integer DEFAULT (unixepoch()) NOT NULL
  )`);
  await client.execute(`CREATE TABLE IF NOT EXISTS "topic_starter_imports" (
    "id" text PRIMARY KEY NOT NULL,
    "caselist_slug" text NOT NULL,
    "caselist_label" text DEFAULT '' NOT NULL,
    "archive_file_name" text NOT NULL,
    "archive_url" text NOT NULL,
    "r2_key" text NOT NULL,
    "topic_code" text,
    "year" integer,
    "published" integer DEFAULT true NOT NULL,
    "status" text DEFAULT 'queued' NOT NULL,
    "found" integer DEFAULT 0 NOT NULL,
    "imported" integer DEFAULT 0 NOT NULL,
    "failed" integer DEFAULT 0 NOT NULL,
    "failures" text DEFAULT '[]' NOT NULL,
    "error" text,
    "requested_by" text,
    "created_at" integer DEFAULT (unixepoch()) NOT NULL,
    "started_at" integer,
    "finished_at" integer
  )`);
  return drizzle(client, { schema });
}

async function archiveBytes() {
  const zip = new JSZip();
  zip.file("Glenbrook North/Chen-Patel/1AC.docx", new Uint8Array([1, 2, 3]));
  zip.file("Glenbrook North/Chen-Patel/Neg/DA.docx", new Uint8Array([4, 5, 6]));
  return zip.generateAsync({ type: "uint8array" });
}

beforeEach(() => {
  mocks.bucket = new FakeBucket();
  mocks.downloads.mockReset();
  mocks.fetch.mockReset();
  globalThis.fetch = mocks.fetch as unknown as typeof fetch;
  mocks.db = null;
});

describe("Topic Starter openCaselist sync", () => {
  it("uploads the archive to R2 before returning, then converts it in the background", async () => {
    mocks.db = await database();
    const bytes = await archiveBytes();
    mocks.downloads.mockResolvedValue({
      source: "api",
      notes: [],
      all: { url: "https://files.example/hspolicy26-all-2026-11-10.zip", fileName: "hspolicy26-all-2026-11-10.zip", slug: "hspolicy26", kind: "all", date: "2026-11-10" },
      weekly: [],
    });
    mocks.fetch.mockResolvedValue(new Response(bytes.slice().buffer as ArrayBuffer, { status: 200 }));

    const job = await startTopicStarterSync({ caselist: "hspolicy26", topicCode: "vcx27", requestedBy: "admin@example.com" });
    expect(job.status).toBe("queued");
    expect((mocks.bucket as FakeBucket).objects.size).toBe(1);
    expect([...(mocks.bucket as FakeBucket).objects.keys()][0]).toContain("hspolicy26-all-2026-11-10.zip");
    expect(job.topicCode).toBe("vcx27");
    expect(job.year).toBe(2027);

    const finished = await processTopicStarterImport(job.id);
    if (finished.error) console.log("SYNC ERROR", finished.error);
    expect(finished.status).toBe("succeeded");
    expect(finished.imported).toBe(2);

    const rows = await (mocks.db as any).select().from(topicStarterItems);
    expect(rows.find((row: any) => row.isFolder && row.parentId == null)).toMatchObject({ title: "hspolicy26-all-2026-11-10", topicCode: "vcx27" });
    expect(rows.filter((row: any) => !row.isFolder)).toHaveLength(2);
    for (const row of rows.filter((row: any) => !row.isFolder)) {
      expect(row).toMatchObject({ content: "H4sCMIR", format: "cmir", topicCode: "vcx27", year: 2027 });
    }
    expect(rows.find((row: any) => row.title === "1AC")!.parentId).toBe(rows.find((row: any) => row.title === "Chen-Patel")!.id);
    // A successful run removes its archive from R2.
    expect((mocks.bucket as FakeBucket).objects.size).toBe(0);

    const reread = await getTopicStarterImport(job.id);
    expect(reread).toMatchObject({ status: "succeeded", imported: 2, failed: 0 });
  });

  it("keeps the archive and reports a partial run when a file cannot convert", async () => {
    mocks.db = await database();
    const bytes = await archiveBytes();
    mocks.downloads.mockResolvedValue({
      source: "api",
      notes: [],
      all: { url: "https://files.example/hspolicy26-all-2026-11-10.zip", fileName: "hspolicy26-all-2026-11-10.zip", slug: "hspolicy26", kind: "all", date: "2026-11-10" },
      weekly: [],
    });
    mocks.fetch.mockResolvedValue(new Response(bytes.slice().buffer as ArrayBuffer, { status: 200 }));

    const { docxToStoredCmir } = await import("@debate-ai/reason-docs/lib/topic-starters/import");
    vi.mocked(docxToStoredCmir).mockRejectedValueOnce(new Error("bad docx"));

    const job = await startTopicStarterSync({ caselist: "hspolicy26" });
    const finished = await processTopicStarterImport(job.id);
    expect(finished.status).toBe("partial");
    expect(finished.imported).toBe(1);
    expect(finished.failed).toBe(1);
    expect((mocks.bucket as FakeBucket).objects.size).toBe(1);
  });
});