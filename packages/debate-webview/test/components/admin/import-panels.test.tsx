/** @vitest-environment jsdom */
import { act } from "react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const archive = vi.hoisted(() => ({
  loadCaselistArchive: vi.fn(),
  loadRemoteCaselistArchive: vi.fn(),
  toRows: vi.fn(),
  send: vi.fn(),
  uploadShard: vi.fn(),
}));

vi.mock("@debate-ai/research-evidence/src/caselist/caselist-archive", () => ({
  loadCaselistArchive: archive.loadCaselistArchive,
  loadRemoteCaselistArchive: archive.loadRemoteCaselistArchive,
}));
vi.mock("@debate-ai/research-evidence/src/caselist/caselist-cards", () => ({
  caselistDocumentToCardRows: archive.toRows,
}));
vi.mock("@debate-ai/research-evidence", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@debate-ai/research-evidence")>();
  return {
    ...actual,
    createCardBatchSender: vi.fn(() => archive.send),
    normalizeDebateCardRows: vi.fn((rows: unknown[]) => ({ cards: rows, failures: [] })),
    dedupeCardsById: vi.fn((cards: unknown[]) => ({ cards, duplicates: 0 })),
    uploadDebateCardShard: archive.uploadShard,
  };
});

import { CaselistSyncPanel } from "../../../src/components/admin/data/CaselistSyncPanel";
import { DbBackupPanel } from "../../../src/components/admin/data/DbBackupPanel";
import { DebateCardParquetUpload } from "../../../src/components/admin/data/DebateCardParquetUpload";
import { TopicStarterUpload } from "../../../src/components/admin/topic-starters/TopicStarterUpload";
import {
  bodyText,
  button,
  cleanup,
  clickAsync,
  flush,
  installDomShims,
  jsonResponse,
  mockFetch,
  mount,
  toggle,
} from "../../helpers/dom";

beforeAll(installDomShims);
beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
  // Byte-range reads are unavailable in jsdom; the panel falls back to a whole-file download.
  archive.loadRemoteCaselistArchive.mockReset();
  archive.loadRemoteCaselistArchive.mockRejectedValue(new Error("Range requests unsupported"));
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  archive.loadCaselistArchive.mockReset();
  archive.toRows.mockReset();
  archive.send.mockReset();
  archive.uploadShard.mockReset();
});

function pickFiles(input: HTMLInputElement, files: File[]) {
  Object.defineProperty(input, "files", { configurable: true, value: files });
  act(() => {
    input.dispatchEvent(new Event("change", { bubbles: true }));
  });
}

describe("TopicStarterUpload", () => {
  const fileInput = () => document.querySelector<HTMLInputElement>("input[type=file]")!;

  it("refuses an empty file without uploading", async () => {
    const { calls } = mockFetch([]);
    mount(<TopicStarterUpload />);
    expect(button("Publish files").disabled).toBe(true);
    pickFiles(fileInput(), [new File([], "empty.docx")]);
    await clickAsync(button("Publish files"));
    // Only the imported-files tree's GET; nothing was posted.
    expect(calls.filter((c) => c.method === "POST")).toHaveLength(0);
    expect(bodyText()).toContain('"empty.docx" is empty (0 bytes).');
  });

  it("uploads the form and reports a clean import", async () => {
    const { calls } = mockFetch([
      { method: "POST", match: "/api/admin/topic-starters", respond: { imported: 3, found: 3, failures: [], importId: "imp_1" } },
    ]);
    mount(<TopicStarterUpload />);
    const folder = document.querySelector<HTMLInputElement>("input[placeholder='e.g. 2026 energy topic']")!;
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
    act(() => {
      setter.call(folder, "Energy");
      folder.dispatchEvent(new Event("input", { bubbles: true }));
    });
    toggle(document.querySelector<HTMLInputElement>("input[type=checkbox]")!);
    pickFiles(fileInput(), [new File(["docx bytes"], "camp.docx")]);
    await clickAsync(button("Publish files"));

    const post = calls.find((c) => c.method === "POST")!;
    const form = post.init!.body as FormData;
    expect(form.get("title")).toBe("Energy");
    expect(form.get("published")).toBe("false");
    expect((form.get("file") as File).name).toBe("camp.docx");
    const text = bodyText();
    expect(text).toContain("3 files converted to .cmir and added to Topic Starters.");
    expect(text).toContain("Stored as .cmir and published to Debate Editor for everyone.");
    expect(text).toContain("imp_1");
    expect(button("Publish files").disabled).toBe(true);
    // The imported-files tree reloads after the upload.
    expect(calls.filter((c) => c.method === "GET" && c.url === "/api/admin/topic-starters").length).toBeGreaterThanOrEqual(2);
  });

  it("lists the skipped files of a partial import", async () => {
    mockFetch([
      {
        method: "POST",
        match: "/api/admin/topic-starters",
        respond: { imported: 1, found: 2, failures: [{ path: "camp/bad.docx", code: "PARSE", reason: "Corrupt zip entry" }] },
      },
    ]);
    mount(<TopicStarterUpload />);
    pickFiles(fileInput(), [new File(["zip"], "camp.zip")]);
    await clickAsync(button("Publish files"));
    const text = bodyText();
    expect(text).toContain("1 file converted to .cmir");
    expect(text).toContain("2 files found in the upload");
    expect(text).toContain("camp/bad.docx");
    expect(text).toContain("Corrupt zip entry");
  });

  it("explains an HTML error page and a JSON error with its code", async () => {
    mockFetch([
      {
        method: "POST",
        match: "/api/admin/topic-starters",
        once: true,
        respond: new Response("<html><body><h1>Worker exceeded CPU</h1></body></html>", { status: 503, statusText: "Service Unavailable" }),
      },
      { method: "POST", match: "/api/admin/topic-starters", respond: { error: "Too large", code: "E_SIZE", importId: "imp_9" }, status: 413 },
    ]);
    mount(<TopicStarterUpload />);
    pickFiles(fileInput(), [new File(["x"], "a.docx")]);
    await clickAsync(button("Publish files"));
    expect(bodyText()).toContain("The server returned 503 Service Unavailable instead of a result: Worker exceeded CPU");

    pickFiles(fileInput(), [new File(["x"], "a.docx")]);
    await clickAsync(button("Publish files"));
    expect(bodyText()).toContain("Too large");
    expect(bodyText()).toContain("Cause: E_SIZE");
  });

  it("reports a network failure", async () => {
    globalThis.fetch = vi.fn(async () => {
      throw new Error("Failed to fetch");
    }) as unknown as typeof fetch;
    mount(<TopicStarterUpload />);
    pickFiles(fileInput(), [new File(["x"], "a.docx")]);
    await clickAsync(button("Publish files"));
    expect(bodyText()).toContain("The upload never reached the server: Failed to fetch.");
  });
});

describe("DebateCardParquetUpload", () => {
  const libraryStats = {
    cards: 12000,
    caselists: 4,
    files: [
      { fileName: "shard-0.parquet", rowsImported: 5000, rowsSkipped: 12, lastImportedBy: "boss", lastImportedAt: 1_700_000_000 },
      { fileName: "shard-1.parquet", rowsImported: 7000, rowsSkipped: 0, lastImportedBy: "", lastImportedAt: 0 },
    ],
  };

  it("shows library stats and their failure", async () => {
    mockFetch([{ method: "GET", match: "/api/admin/debate-cards", respond: libraryStats }]);
    mount(<DebateCardParquetUpload />);
    expect(bodyText()).toContain("loading…");
    await flush();
    const text = bodyText();
    expect(text).toContain(`${(12000).toLocaleString()} cards from 2 files, 4 caselists`);
    expect(text).toContain("12 skipped");
    expect(text).toContain("· boss");
    expect(text).toContain("—");
    cleanup();

    mockFetch([{ method: "GET", match: "/api/admin/debate-cards", respond: {}, status: 500 }]);
    mount(<DebateCardParquetUpload />);
    await flush();
    expect(bodyText()).toContain("unavailable — Request failed: 500");
  });

  it("imports picked shards in order and reports each outcome", async () => {
    mockFetch([{ method: "GET", match: "/api/admin/debate-cards", respond: libraryStats }]);
    archive.uploadShard
      .mockImplementationOnce(async (options: { onProgress: (p: unknown) => void; fileName: string }) => {
        options.onProgress({ read: 50, imported: 40, duplicates: 0, skipped: 10, total: 100 });
        return {
          progress: { read: 100, imported: 90, duplicates: 2, skipped: 8, total: 100 },
          failures: [{ rowIndex: 7, code: "NO_TAG", reason: "missing tag" }],
        };
      })
      .mockImplementationOnce(async () => {
        throw new Error("Corrupt parquet footer");
      });
    mount(<DebateCardParquetUpload />);
    await flush();
    pickFiles(document.querySelector<HTMLInputElement>("input[type=file]")!, [
      new File(["a"], "one.parquet"),
      new File(["b"], "two.parquet"),
    ]);
    expect(bodyText()).toContain("0 imported · 0 rows read");
    await clickAsync(button("Import 2 files"));

    expect(archive.uploadShard).toHaveBeenCalledTimes(2);
    expect(archive.uploadShard.mock.calls[0][0].fileName).toBe("one.parquet");
    expect(archive.uploadShard.mock.calls[0][0].source.byteLength).toBe(1);
    const text = bodyText();
    expect(text).toContain("one.parquet: 90 cards imported, 2 duplicate ids skipped, 8 rows skipped (100 rows read).");
    expect(text).toContain("1 skipped row");
    expect(text).toContain("row 7: NO_TAG — missing tag");
    expect(text).toContain("Corrupt parquet footer");
    expect(text).toContain("failed");
  });
});

describe("DbBackupPanel", () => {
  const status = {
    groups: [
      { key: "videos", label: "Videos", tables: [{ name: "videos", scrubbed: [] }] },
      { key: "cards", label: "Debate cards", tables: [{ name: "debate_cards", scrubbed: ["imported_by"] }] },
    ],
    r2Configured: true,
    kvConfigured: true,
    sevenZipMaxBytes: 25 * 1024 * 1024,
    weeklyBackupsKept: 4,
    backups: [
      {
        key: "b1",
        fileName: "backup-1.sql",
        size: 2048,
        uploaded: "2024-01-01T00:00:00.000Z",
        trigger: "weekly",
        groups: "videos,cards",
        url: "/api/admin/db-backup/b1",
        sevenZip: { key: "b1.7z", size: 512, url: "/api/admin/db-backup/b1.7z" },
      },
    ],
    listError: "One listing page failed",
  };

  it("lists groups and stored backups with download links", async () => {
    mockFetch([{ method: "GET", match: "/api/admin/db-backup", respond: status }]);
    mount(<DbBackupPanel />);
    expect(bodyText()).toContain("Loading…");
    await flush();
    const text = bodyText();
    expect(text).toContain("debate_cards (no imported_by)");
    expect(text).toContain("backup-1.sql");
    expect(text).toContain("2.0 KB");
    expect(text).toContain("videos, cards");
    expect(text).toContain("(512 B, KV)");
    expect(text).toContain("25.0 MB or less");
    expect(text).toContain("One listing page failed");
    const zip = [...document.querySelectorAll("a")].find((a) => a.textContent === "Download .zip")!;
    expect(zip.getAttribute("href")).toBe("/api/admin/db-backup/download?groups=videos%2Ccards");

    // Unticking every group disables the downloads.
    for (const box of document.querySelectorAll<HTMLInputElement>("input[type=checkbox]")) toggle(box);
    expect(zip.getAttribute("href")).toBeNull();
    expect(zip.getAttribute("aria-disabled")).toBe("true");
  });

  it("explains a missing R2 binding and a load failure", async () => {
    mockFetch([{ method: "GET", match: "/api/admin/db-backup", respond: { ...status, r2Configured: false, backups: [] } }]);
    mount(<DbBackupPanel />);
    await flush();
    expect(bodyText()).toContain("R2 is not bound");
    expect(button("Save to R2").disabled).toBe(true);
    cleanup();

    mockFetch([{ method: "GET", match: "/api/admin/db-backup", respond: { details: "No D1" }, status: 500 }]);
    mount(<DbBackupPanel />);
    await flush();
    expect(bodyText()).toContain("No D1");
  });

  it("saves to R2 and reports the result", async () => {
    const { calls } = mockFetch([
      {
        method: "POST",
        match: "/api/admin/db-backup",
        respond: {
          backup: { fileName: "backup-2.sql", size: 3 * 1024 * 1024 * 1024, url: "/dl/2", sevenZip: null },
          stats: { totalRows: 1500, missing: ["old_table"] },
          sevenZipSkipped: "too large",
        },
      },
      { method: "GET", match: "/api/admin/db-backup", respond: { ...status, kvConfigured: false, backups: [] } },
    ]);
    mount(<DbBackupPanel />);
    await flush();
    await clickAsync(button("Save to R2"));
    expect(calls.find((c) => c.method === "POST")!.body).toEqual({ groups: ["videos", "cards"] });
    const text = bodyText();
    expect(text).toContain(`Saved backup-2.sql (3.00 GB, ${(1500).toLocaleString()} rows) — tables not in this database: old_table; no 7z copy: too large`);
    expect(text).toContain("No backups in R2 yet.");
    expect(text).toContain("Bind a KV namespace");
  });

  it("saves with a 7z copy, and shows a failed save", async () => {
    mockFetch([
      {
        method: "POST",
        match: "/api/admin/db-backup",
        once: true,
        respond: { backup: { fileName: "b.sql", size: 100, url: "/dl/b", sevenZip: { size: 2048, url: "/dl/b.7z" } }, stats: { totalRows: 1 } },
      },
      { method: "POST", match: "/api/admin/db-backup", respond: { error: "R2 write failed" }, status: 500 },
      { method: "GET", match: "/api/admin/db-backup", respond: status },
    ]);
    mount(<DbBackupPanel />);
    await flush();
    await clickAsync(button("Save to R2"));
    expect(bodyText()).toContain("Saved b.sql (100 B, 1 rows); 7z copy in KV (2.0 KB)");
    expect([...document.querySelectorAll("a")].some((a) => a.getAttribute("href") === "/dl/b.7z")).toBe(true);
    await clickAsync(button("Save to R2"));
    expect(bodyText()).toContain("R2 write failed");
  });

  it("deletes a stored backup after confirmation and copies its link", async () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValueOnce(false).mockReturnValue(true);
    const writeText = vi.fn();
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
    const { calls } = mockFetch([
      { method: "DELETE", match: "/api/admin/db-backup/b1", respond: { error: "Locked" }, status: 500, once: true },
      { method: "DELETE", match: "/api/admin/db-backup/b1", respond: { ok: true } },
      { method: "GET", match: "/api/admin/db-backup", respond: status },
    ]);
    mount(<DbBackupPanel />);
    await flush();

    await clickAsync(button("Copy link"));
    expect(writeText).toHaveBeenCalledWith(`${window.location.origin}/api/admin/db-backup/b1`);

    await clickAsync(button("Delete"));
    expect(confirm.mock.calls[0][0]).toBe("Delete backup-1.sql from R2 and its .7z copy from KV? This cannot be undone.");
    expect(calls.some((c) => c.method === "DELETE")).toBe(false);
    await clickAsync(button("Delete"));
    expect(bodyText()).toContain("Locked");
    await clickAsync(button("Delete"));
    expect(bodyText()).toContain("Deleted backup-1.sql.");
  });
});

describe("CaselistSyncPanel", () => {
  const caselists = [
    { slug: "hspolicy26", label: "HS Policy 2026-27", event: "policy", level: "hs", year: 2026 },
    { slug: "hsld26", label: "HS LD 2026-27", event: "ld", level: "hs", year: 2026 },
    { slug: "ndtceda26", label: "NDT/CEDA 2026-27", event: "policy", level: "college", year: 2026 },
  ];
  const pending = { url: "https://bucket/hspolicy26-weekly.zip", fileName: "hspolicy26-weekly.zip", slug: "hspolicy26", kind: "weekly" };

  it("reports a discovery failure", async () => {
    mockFetch([{ match: /\/api\/admin\/caselist-sync$/, respond: { details: "openCaselist down" }, status: 502 }]);
    mount(<CaselistSyncPanel />);
    await clickAsync(button("Sync all speech docs"));
    expect(bodyText()).toContain("openCaselist down");
  });

  it("only checks what is new when asked", async () => {
    const { calls } = mockFetch([
      { match: /caselist-sync$/, respond: { caselists: caselists.slice(0, 1) } },
      {
        match: "caselist-sync?slug=hspolicy26",
        respond: { caselist: caselists[0], source: "none", notes: ["No archives yet"], archives: [], latest: [], imported: [], pending: [] },
      },
    ]);
    mount(<CaselistSyncPanel />);
    toggle(document.querySelector<HTMLInputElement>("input[type=checkbox]")!);
    await clickAsync(button("Check for new archives"));
    await flush();
    expect(calls.map((c) => c.url)).toEqual(["/api/admin/caselist-sync", "/api/admin/caselist-sync?slug=hspolicy26"]);
    const text = bodyText();
    expect(text).toContain("HS Policy 2026-27");
    expect(text).toContain("0 archive(s) via none · latest: none · up to date");
    expect(text).toContain("Why nothing was found");
    expect(text).toContain("No archives yet");
    expect(text).toContain("done");
  });

  it("downloads pending archives, posts their cards and tallies each caselist", async () => {
    mockFetch([
      { match: /caselist-sync$/, respond: { caselists } },
      {
        match: "caselist-sync?slug=hspolicy26",
        respond: { caselist: caselists[0], source: "bucket", notes: [], archives: [pending], latest: ["hspolicy26-weekly.zip"], imported: [], pending: [pending] },
      },
      { match: "caselist-sync?slug=hsld26", respond: { error: "LD discovery failed" }, status: 500 },
      {
        match: "caselist-sync?slug=ndtceda26",
        respond: {
          caselist: caselists[2],
          source: "bucket",
          notes: [],
          archives: [{ ...pending, url: "https://bucket/ndt.zip", fileName: "ndt.zip" }],
          latest: [],
          imported: [],
          pending: [{ ...pending, url: "https://bucket/ndt.zip", fileName: "ndt.zip" }],
        },
      },
      { match: "https://bucket/hspolicy26-weekly.zip", respond: () => new Response(new Uint8Array([1, 2, 3])) },
      { match: "https://bucket/ndt.zip", respond: () => new Response("gone", { status: 404 }) },
    ]);
    archive.toRows.mockImplementation(() => [{ id: 1 }, { id: 2 }]);
    archive.send.mockImplementation(async (batch: unknown[]) => ({ imported: batch.length }));
    archive.loadCaselistArchive.mockImplementation(async (_bytes: ArrayBuffer, options: { slug: string; onDocument: (d: unknown) => Promise<void> }) => {
      await options.onDocument({ name: "doc1" });
      await options.onDocument({ name: "doc2" });
      return { importedCount: 2, failures: [{ path: "bad.docx" }] };
    });

    mount(<CaselistSyncPanel />);
    await clickAsync(button("Sync all speech docs"));
    await flush(10);

    expect(archive.loadCaselistArchive).toHaveBeenCalledTimes(1);
    expect(archive.loadCaselistArchive.mock.calls[0][1].slug).toBe("hspolicy26");
    expect(archive.send).toHaveBeenCalledTimes(1);
    expect(archive.send.mock.calls[0][0]).toHaveLength(4);
    expect(archive.send.mock.calls[0][1]).toEqual({ fileName: "hspolicy26-weekly.zip", batchIndex: 0 });
    const text = bodyText();
    expect(text).toContain("1 to import: hspolicy26-weekly.zip");
    expect(text).toContain("1 archive(s) · 2 docs · 4 cards · 1 unreadable docs");
    expect(text).toContain("LD discovery failed");
    expect(archive.loadRemoteCaselistArchive.mock.calls.map((c) => c[0])).toEqual([
      "https://bucket/hspolicy26-weekly.zip",
      "https://bucket/ndt.zip",
    ]);
    expect(text).toContain("Reading by byte range failed (Range requests unsupported); downloading the whole file instead.");
    expect(text).toContain("Downloading ndt.zip failed: HTTP 404");
    expect(text).toContain("failed");
    expect(button("Sync all speech docs").disabled).toBe(false);
  });

  it("stops between caselists when Stop is pressed", async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    mockFetch([
      { match: /caselist-sync$/, respond: { caselists: caselists.slice(0, 2) } },
      {
        match: "caselist-sync?slug=hspolicy26",
        respond: async () => {
          await gate;
          return jsonResponse({ caselist: caselists[0], source: "bucket", notes: [], archives: [], latest: [], imported: [], pending: [pending] });
        },
      },
    ]);
    mount(<CaselistSyncPanel />);
    await clickAsync(button("Sync all speech docs"));
    expect(bodyText()).toContain("discovering");
    await clickAsync(button("Stop"));
    release();
    await flush(10);
    const text = bodyText();
    expect(text).toContain("cancelled");
    expect(archive.loadCaselistArchive).not.toHaveBeenCalled();
  });
});
