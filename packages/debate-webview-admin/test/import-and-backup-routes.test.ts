// @vitest-environment node
/**
 * @fileoverview The admin routes for importing and checking content and for
 * database backups: the Topic Starter importer, card source-URL extraction
 * and validation, and the R2 backup endpoints. Run
 * against a real in-memory database; R2, KV, the DOCX converter and the
 * scraper are stood in for where they would reach outside the process.
 *
 * Node rather than this package's default jsdom: the importer checks the
 * upload with `instanceof File`, and the form data Node's `Request` parses
 * holds Node's `File`, as it does on Workers, not jsdom's.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import JSZip from "jszip";
import { debateCards, topicStarterItems } from "@/lib/database/schema";
import { ADMIN, MODERATOR, access } from "./helpers/access";
import { freshDb, request, type DB } from "./helpers/db";

vi.mock("@/lib/auth/session", async () => (await import("./helpers/access")).sessionMock);
vi.mock("@/lib/database/context", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  ...(await import("./helpers/access")).contextMock,
}));

const stubs = vi.hoisted(() => ({
  docxToStoredCmir: vi.fn(),
  bucket: null as unknown,
  kv: null as unknown,
  listBackups: vi.fn(),
  createR2Backup: vi.fn(),
  deleteBackups: vi.fn(),
}));
vi.mock("@debate-ai/webview/lib/topic-starters/import", () => ({ docxToStoredCmir: stubs.docxToStoredCmir }));
vi.mock("@/lib/admin/db-backup-r2", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  getBackupBucket: () => stubs.bucket,
  getBackupKv: () => stubs.kv,
  listBackups: stubs.listBackups,
  createR2Backup: stubs.createR2Backup,
  deleteBackups: stubs.deleteBackups,
}));

const topicStarters = await import("../src/api/admin/topic-starters");
const extractUrls = await import("../src/api/admin/debate-cards/extract-urls");
const validateUrls = await import("../src/api/admin/debate-cards/validate-urls");
const backup = await import("../src/api/admin/db-backup");
const backupDownload = await import("../src/api/admin/db-backup/download");
const backupFile = await import("../src/api/admin/db-backup/file");

let db: DB;

beforeEach(async () => {
  vi.stubEnv("ADMIN_EMAILS", ADMIN);
  vi.stubEnv("CARD_IMPORT_TOKEN", "");
  db = await freshDb();
  access.db = db;
  access.email = ADMIN;
  for (const stub of Object.values(stubs)) if (typeof stub === "function") stub.mockReset();
  stubs.bucket = null;
  stubs.kv = null;
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "info").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("/api/admin/topic-starters", () => {
  /** Bytes with a ZIP signature — all the importer checks before converting. */
  const docxBytes = async (marker: string) => {
    const zip = new JSZip();
    zip.file("word/document.xml", marker);
    return zip.generateAsync({ type: "uint8array" });
  };

  function upload(file: File | null, fields: Record<string, string> = {}) {
    const form = new FormData();
    if (file) form.set("file", file);
    for (const [key, value] of Object.entries(fields)) form.set(key, value);
    return topicStarters.POST(new Request("http://localhost/api/admin/topic-starters", { method: "POST", body: form }) as never);
  }

  beforeEach(() => {
    stubs.docxToStoredCmir.mockImplementation(async (bytes: Uint8Array) => {
      const zip = await JSZip.loadAsync(bytes);
      const marker = await zip.file("word/document.xml")!.async("string");
      if (marker === "broken") throw new Error("Could not read word/document.xml");
      return `cmir:${marker}`;
    });
  });

  it("imports one .docx under a root folder", async () => {
    const res = await upload(new File([await docxBytes("aff")], "Aff Case.docx"));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body).toMatchObject({ found: 1, imported: 1, failures: [], root: { title: "Aff Case", isFolder: true } });

    const rows = await db.select().from(topicStarterItems);
    const file = rows.find((row) => !row.isFolder);
    expect(file).toMatchObject({ title: "Aff Case", content: "cmir:aff", parentId: body.root.id, published: true });
  });

  it("mirrors a zip's folders, keeps going past a bad file, and honours the title and draft flag", async () => {
    const archive = new JSZip();
    archive.file("Aff/1AC.docx", await docxBytes("1ac"));
    archive.file("Aff/Blocks/Frontlines.docx", await docxBytes("blocks"));
    archive.file("Neg/Broken.docx", await docxBytes("broken"));
    const zip = await archive.generateAsync({ type: "uint8array" });

    const res = await upload(new File([zip], "pack.zip"), { title: "September Pack", published: "false" });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body).toMatchObject({ found: 3, imported: 2, root: { title: "September Pack", published: false } });
    expect(body.failures).toEqual([expect.objectContaining({ path: "Neg/Broken.docx" })]);

    const titles = (await db.select().from(topicStarterItems)).map((row) => row.title).sort();
    // No "Neg" folder: the only file under it failed before any row was written.
    expect(titles).toEqual(["1AC", "Aff", "Blocks", "Frontlines", "September Pack"]);

    const listed = await (await topicStarters.GET()).json();
    expect(listed.items).toHaveLength(5);
  });

  it("drops the root folder when every file fails", async () => {
    const res = await upload(new File([await docxBytes("broken")], "Bad.docx"));
    expect(res.status).toBe(422);
    expect((await res.json()).root).toBeNull();
    expect(await db.select().from(topicStarterItems)).toEqual([]);
  });

  it("rejects a missing file or an unsupported upload", async () => {
    expect((await upload(null)).status).toBe(400);
    const res = await upload(new File(["hello"], "notes.txt"));
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe("unsupported-extension");
  });

  it("reports a crash as JSON, not an HTML error page", async () => {
    access.db = {
      insert: () => {
        throw new Error("D1 down");
      },
    };
    const res = await upload(new File([await docxBytes("aff")], "Aff.docx"));
    expect(res.status).toBe(500);
    expect((await res.json()).error).toContain("D1 down");
  });

  it("is admin-only", async () => {
    access.email = MODERATOR;
    expect((await topicStarters.GET()).status).toBe(403);
    expect((await upload(null)).status).toBe(403);
  });
});

describe("card source URLs", () => {
  async function seedCards() {
    await db.insert(debateCards).values([
      { tag: "Warming", cite: "Smith 21", fullcite: "Smith 21, https://example.org/a" },
      { tag: "Trade", cite: "Jones 20", fullcite: "Jones 20, no link" },
      { tag: "Dedev", cite: "Lee 19", fullcite: "Lee 19 https://example.org/c" },
    ] as never);
  }

  it("extracts source URLs a page at a time", async () => {
    await seedCards();
    const first = await (await extractUrls.POST(request("/x", { method: "POST", body: { limit: 2 } }))).json();
    expect(first).toMatchObject({ processed: 2, withUrl: 1, done: false, demoUrls: ["https://example.org/a"] });
    const rest = await (await extractUrls.POST(request("/x", { method: "POST", body: { afterId: first.nextAfterId } }))).json();
    expect(rest).toMatchObject({ processed: 1, withUrl: 1, done: true });

    const urls = (await db.select().from(debateCards)).map((card) => card.sourceUrl);
    expect(urls).toEqual(["https://example.org/a", "", "https://example.org/c"]);
  });

  it("checks extracted URLs with HEAD requests", async () => {
    await seedCards();
    await extractUrls.POST(request("/x", { method: "POST" }));
    const fetchMock = vi.fn(async (url: string) => {
      if (url.endsWith("/a")) return new Response(null, { status: 200 });
      throw new TypeError("getaddrinfo ENOTFOUND");
    });
    vi.stubGlobal("fetch", fetchMock);

    const body = await (await validateUrls.POST(request("/x", { method: "POST", body: { timeoutMs: 5 } }))).json();
    expect(body).toMatchObject({ processed: 2, valid: 1, invalid: 0, errors: 1, done: true });
    expect(body.results[1]).toMatchObject({ status: "error", error: "getaddrinfo ENOTFOUND" });
    expect(fetchMock).toHaveBeenCalledWith("https://example.org/a", expect.objectContaining({ method: "HEAD" }));
  });

  it("reports HTTP errors and timeouts", async () => {
    await db.insert(debateCards).values([
      { tag: "a", sourceUrl: "https://example.org/missing" },
      { tag: "b", sourceUrl: "https://example.org/slow" },
    ] as never);
    vi.stubGlobal("fetch", async (url: string) => {
      if (url.endsWith("/missing")) return new Response(null, { status: 404 });
      throw new DOMException("aborted", "AbortError");
    });
    const body = await (await validateUrls.POST(request("/x", { method: "POST" }))).json();
    expect(body.results).toEqual([
      expect.objectContaining({ status: "invalid", statusCode: 404, error: "HTTP 404" }),
      expect.objectContaining({ status: "error", error: "Timeout after 8000ms" }),
    ]);
  });

  it("is admin-only", async () => {
    access.email = MODERATOR;
    expect((await extractUrls.POST(request("/x", { method: "POST" }))).status).toBe(403);
    expect((await validateUrls.POST(request("/x", { method: "POST" }))).status).toBe(403);
  });
});

describe("database backups", () => {
  const KEY = "db-backups/2026-09-01-manual.sql.gz";

  it("describes the backup groups and whether R2 is set up", async () => {
    const body = await (await backup.GET()).json();
    expect(body).toMatchObject({ r2Configured: false, kvConfigured: false, backups: [], listError: null });
    expect(body.groups.length).toBeGreaterThan(0);
    expect(body.groups[0]).toHaveProperty("tables");
  });

  it("lists stored backups, or the reason it couldn't", async () => {
    stubs.bucket = {};
    stubs.listBackups.mockResolvedValue([{ key: KEY }]);
    expect((await (await backup.GET()).json()).backups).toEqual([{ key: KEY }]);

    stubs.listBackups.mockRejectedValue(new Error("R2 unavailable"));
    expect((await (await backup.GET()).json()).listError).toContain("R2 unavailable");
  });

  it("needs R2 to take a backup", async () => {
    expect((await backup.POST(request("/x", { method: "POST", body: {} }))).status).toBe(503);
  });

  it("takes a manual backup of the chosen groups", async () => {
    stubs.bucket = {};
    stubs.createR2Backup.mockResolvedValue({ key: KEY, bytes: 10 });
    const res = await backup.POST(request("/x", { method: "POST", body: { groups: ["nonsense"] } }));
    expect(await res.json()).toEqual({ ok: true, key: KEY, bytes: 10 });
    expect(stubs.createR2Backup.mock.calls[0][3]).toBe("manual");

    stubs.createR2Backup.mockRejectedValue(new Error("quota"));
    expect((await backup.POST(request("/x", { method: "POST" }))).status).toBe(500);
  });

  it("streams a SQL dump, zipped by default", async () => {
    const sql = await backupDownload.GET(request("/x?format=sql"));
    expect(sql.headers.get("content-type")).toContain("application/sql");
    expect(sql.headers.get("content-disposition")).toMatch(/\.sql"$/);
    expect(await sql.text()).toContain("CREATE TABLE");

    const zip = await backupDownload.GET(request("/x"));
    expect(zip.headers.get("content-type")).toBe("application/zip");
    const bytes = new Uint8Array(await zip.arrayBuffer());
    expect(String.fromCharCode(bytes[0], bytes[1])).toBe("PK");
  });

  it("downloads a stored backup from R2 or KV", async () => {
    stubs.bucket = {
      get: async (key: string) =>
        key === KEY ? { body: "gz-bytes", size: 8, httpMetadata: { contentType: "application/gzip" } } : null,
    };
    const res = await backupFile.GET(request(`/x?key=${encodeURIComponent(KEY)}`));
    expect(res.headers.get("content-length")).toBe("8");
    expect(await res.text()).toBe("gz-bytes");
    expect((await backupFile.GET(request("/x?key=db-backups/other.sql.gz"))).status).toBe(404);

    const sevenZip = "db-backups/2026-09-01-weekly.sql.7z";
    expect((await backupFile.GET(request(`/x?key=${sevenZip}`))).status).toBe(503);
    stubs.kv = { get: async (key: string) => (key === sevenZip ? "7z-bytes" : null) };
    const fromKv = await backupFile.GET(request(`/x?key=${sevenZip}`));
    expect(fromKv.headers.get("content-type")).toBe("application/x-7z-compressed");
    expect(await fromKv.text()).toBe("7z-bytes");
    expect((await backupFile.GET(request("/x?key=db-backups/gone.sql.7z"))).status).toBe(404);
  });

  it("deletes a stored backup", async () => {
    stubs.bucket = {};
    const res = await backupFile.DELETE(request(`/x?key=${KEY}`, { method: "DELETE" }));
    expect(await res.json()).toEqual({ ok: true, key: KEY });
    expect(stubs.deleteBackups).toHaveBeenCalledWith(stubs.bucket, [KEY], null);

    stubs.deleteBackups.mockRejectedValue(new Error("nope"));
    expect((await backupFile.DELETE(request(`/x?key=${KEY}`, { method: "DELETE" }))).status).toBe(500);
  });

  it("refuses bad keys and a missing bucket", async () => {
    expect((await backupFile.GET(request(`/x?key=${KEY}`))).status).toBe(503);
    stubs.bucket = {};
    expect((await backupFile.GET(request("/x?key=../secrets.sql"))).status).toBe(400);
    expect((await backupFile.DELETE(request("/x?key=elsewhere/x.sql", { method: "DELETE" }))).status).toBe(400);
  });

  it("is admin-only", async () => {
    access.email = MODERATOR;
    expect((await backup.GET()).status).toBe(403);
    expect((await backup.POST(request("/x", { method: "POST" }))).status).toBe(403);
    expect((await backupDownload.GET(request("/x"))).status).toBe(403);
    expect((await backupFile.GET(request(`/x?key=${KEY}`))).status).toBe(403);
    expect((await backupFile.DELETE(request(`/x?key=${KEY}`, { method: "DELETE" }))).status).toBe(403);
  });
});
