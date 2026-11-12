/** @vitest-environment jsdom */
/**
 * @fileoverview Two Imports/Backups panels: the Topic Starter upload (empty
 * file, success, partial import with skipped files, a server error with a
 * non-JSON body, and a request that never arrives) and the SQL backup panel
 * (groups, download links, saving to R2, the stored-backup list, copy link
 * and a confirmed delete).
 */
import { act } from "react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { DbBackupPanel } from "../../src/components/data/DbBackupPanel";
import { TopicStarterUpload } from "../../src/components/topic-starters/TopicStarterUpload";
import { bodyText, button, change, cleanup, click, flush, installDomShims, mockFetch, mount, toggle, type Route } from "../helpers/dom";

beforeAll(installDomShims);
beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function pickFile(file: File) {
  const input = document.querySelector<HTMLInputElement>('input[type="file"]')!;
  Object.defineProperty(input, "files", { configurable: true, value: [file] });
  act(() => {
    input.dispatchEvent(new Event("change", { bubbles: true }));
  });
}

const status = () => document.querySelector("[role=status]")!.textContent;

describe("TopicStarterUpload", () => {
  it("refuses an empty file", async () => {
    const { calls } = mockFetch([]);
    mount(<TopicStarterUpload />);
    expect(button("Publish files").disabled).toBe(true);
    pickFile(new File([], "empty.docx"));
    click(button("Publish files"));
    await flush();
    expect(status()).toContain('"empty.docx" is empty (0 bytes).');
    expect(calls).toHaveLength(0);
  });

  it("uploads with the published flag and no folder name, and reports success", async () => {
    const { calls } = mockFetch([{ method: "POST", match: "/api/admin/topic-starters", respond: { imported: 1, found: 1, importId: "imp-1" } }]);
    mount(<TopicStarterUpload />);
    expect(bodyText()).not.toContain("Folder name");
    toggle(document.querySelector<HTMLInputElement>('input[type="checkbox"]')!);
    pickFile(new File(["x"], "aff.docx"));
    click(button("Publish files"));
    await flush();
    const form = calls[0].init!.body as FormData;
    expect(form.get("title")).toBeNull();
    expect(form.get("published")).toBe("false");
    expect((form.get("file") as File).name).toBe("aff.docx");
    expect(status()).toContain("1 file converted to .cmir and added to Topic Starters.");
    expect(status()).toContain("imp-1");
    expect(button("Publish files").disabled).toBe(true);
  });

  it("lists the files a partial import skipped", async () => {
    mockFetch([
      {
        method: "POST",
        match: "/api/admin/topic-starters",
        respond: { imported: 2, found: 3, failures: [{ path: "bad/neg.docx", code: "PARSE", reason: "Not a Word file" }] },
      },
    ]);
    mount(<TopicStarterUpload />);
    pickFile(new File(["zip"], "batch.zip"));
    click(button("Publish files"));
    await flush();
    expect(status()).toContain("2 files converted");
    expect(status()).toContain("3 files found in the upload");
    expect(status()).toContain("bad/neg.docx");
    expect(status()).toContain("Not a Word file");
  });

  it("explains a server error, even an HTML one", async () => {
    mockFetch([
      { method: "POST", match: "topic-starters", respond: { error: "Too big", code: "R2_LIMIT", importId: "imp-2" }, status: 413, once: true },
      { method: "POST", match: "topic-starters", respond: new Response("<h1>Bad gateway</h1>", { status: 502, statusText: "Bad Gateway" }), once: true },
      { method: "POST", match: "topic-starters", respond: new Response("", { status: 500 }) },
    ]);
    mount(<TopicStarterUpload />);
    pickFile(new File(["x"], "a.docx"));
    click(button("Publish files"));
    await flush();
    expect(status()).toContain("Too big");
    expect(status()).toContain("Cause: R2_LIMIT");
    click(button("Publish files"));
    await flush();
    expect(status()).toContain("The server returned 502 Bad Gateway instead of a result: Bad gateway");
    click(button("Publish files"));
    await flush();
    expect(status()).toContain("Upload failed (HTTP 500).");
  });

  it("reports a request that never reached the server", async () => {
    globalThis.fetch = vi.fn(async () => {
      throw new Error("Failed to fetch");
    }) as unknown as typeof fetch;
    mount(<TopicStarterUpload />);
    pickFile(new File(["x"], "a.docx"));
    click(button("Publish files"));
    await flush();
    expect(status()).toContain("The upload never reached the server: Failed to fetch.");
  });
});

const backupStatus = (overrides: Record<string, unknown> = {}) => ({
  groups: [
    { key: "videos", label: "Videos", tables: [{ name: "videos", scrubbed: ["editor"] }] },
    { key: "cards", label: "Debate cards", tables: [{ name: "debate_cards", scrubbed: [] }] },
  ],
  r2Configured: true,
  kvConfigured: true,
  sevenZipMaxBytes: 25 * 1024 * 1024,
  weeklyBackupsKept: 4,
  backups: [
    {
      key: "b1",
      fileName: "backup-1.sql.zip",
      size: 3 * 1024 * 1024 * 1024,
      uploaded: "2026-11-01T07:00:00Z",
      trigger: "weekly",
      groups: "videos,cards",
      url: "/api/admin/db-backup/b1",
      sevenZip: { key: "b1.7z", size: 512, url: "/api/admin/db-backup/b1.7z" },
    },
  ],
  listError: null,
  ...overrides,
});

async function renderBackups(routes: Route[], s: unknown = backupStatus()) {
  const mock = mockFetch([...routes, { method: "GET", match: "/api/admin/db-backup", respond: s }]);
  mount(<DbBackupPanel />);
  await flush();
  return mock;
}

describe("DbBackupPanel", () => {
  it("lists groups with scrubbed columns and builds download links from the selection", async () => {
    await renderBackups([]);
    expect(bodyText()).toContain("videos (no editor)");
    const zip = () => [...document.querySelectorAll("a")].find((a) => a.textContent === "Download .zip")!;
    expect(zip().getAttribute("href")).toBe(`/api/admin/db-backup/download?groups=${encodeURIComponent("videos,cards")}`);
    const boxes = document.querySelectorAll<HTMLInputElement>('input[type="checkbox"]');
    toggle(boxes[0]);
    toggle(boxes[1]);
    expect(zip().getAttribute("href")).toBeNull();
    expect(button("Save to R2").disabled).toBe(true);
    toggle(boxes[1]);
    expect([...document.querySelectorAll("a")].find((a) => a.textContent === "Download .sql")!.getAttribute("href")).toBe(
      "/api/admin/db-backup/download?groups=cards&format=sql",
    );
  });

  it("shows stored backups with their 7z copies and copies a link", async () => {
    const writeText = vi.fn();
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
    await renderBackups([]);
    expect(bodyText()).toContain("3.00 GB · videos, cards");
    expect(bodyText()).toContain("(512 B, KV)");
    expect(bodyText()).toContain("compresses to 25.0 MB or less");
    expect(bodyText()).toContain("weekly");
    click(button("Copy link"));
    expect(writeText).toHaveBeenCalledWith(`${window.location.origin}/api/admin/db-backup/b1`);
  });

  it("saves a backup to R2 and reports it", async () => {
    const { calls } = await renderBackups([
      {
        method: "POST",
        match: "/api/admin/db-backup",
        respond: {
          backup: { fileName: "new.sql.zip", size: 2048, url: "/b/new", sevenZip: { size: 100, url: "/b/new.7z" } },
          stats: { totalRows: 12000, missing: ["old_table"] },
        },
        once: true,
      },
      {
        method: "POST",
        match: "/api/admin/db-backup",
        respond: { backup: { fileName: "n2.sql.zip", size: 5 * 1024 * 1024, url: "/b/n2", sevenZip: null }, stats: { totalRows: 1 }, sevenZipSkipped: "too large" },
        once: true,
      },
      { method: "POST", match: "/api/admin/db-backup", respond: { error: "R2 write failed" }, status: 500 },
    ]);
    click(button("Save to R2"));
    await flush();
    expect(calls.find((c) => c.method === "POST")!.body).toEqual({ groups: ["videos", "cards"] });
    expect(bodyText()).toContain("Saved new.sql.zip (2.0 KB, 12,000 rows) — tables not in this database: old_table; 7z copy in KV (100 B)");
    expect(document.querySelector('a[href="/b/new.7z"]')).not.toBeNull();
    click(button("Save to R2"));
    await flush();
    expect(bodyText()).toContain("Saved n2.sql.zip (5.0 MB, 1 rows); no 7z copy: too large");
    click(button("Save to R2"));
    await flush();
    expect(bodyText()).toContain("R2 write failed");
  });

  it("deletes a backup only after confirming", async () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValueOnce(false).mockReturnValue(true);
    const { calls } = await renderBackups([
      { method: "DELETE", match: "/api/admin/db-backup/b1", respond: { ok: true }, once: true },
      { method: "DELETE", match: "/api/admin/db-backup/b1", respond: { details: "Locked" }, status: 423 },
    ]);
    click(button("Delete"));
    expect(confirm).toHaveBeenCalledWith("Delete backup-1.sql.zip from R2 and its .7z copy from KV? This cannot be undone.");
    expect(calls.some((c) => c.method === "DELETE")).toBe(false);
    click(button("Delete"));
    await flush();
    expect(bodyText()).toContain("Deleted backup-1.sql.zip.");
    click(button("Delete"));
    await flush();
    expect(bodyText()).toContain("Locked");
  });

  it("explains a missing R2 bucket and KV namespace, and an empty list", async () => {
    await renderBackups([], backupStatus({ r2Configured: false }));
    expect(bodyText()).toContain("R2 is not bound");
    cleanup();
    await renderBackups([], backupStatus({ kvConfigured: false, backups: [], listError: "List failed" }));
    expect(bodyText()).toContain("Bind a KV namespace as DB_BACKUPS_KV");
    expect(bodyText()).toContain("No backups in R2 yet.");
    expect(bodyText()).toContain("List failed");
  });

  it("shows a load failure", async () => {
    mockFetch([{ match: "/api/admin/db-backup", respond: { error: "Forbidden" }, status: 403 }]);
    mount(<DbBackupPanel />);
    expect(bodyText()).toContain("Loading…");
    await flush();
    expect(bodyText()).toContain("Forbidden");
  });
});
