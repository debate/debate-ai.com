/**
 * @fileoverview Covers discovery and incremental state: the three-source
 * fallback that exists because `/{slug}/downloads` is client-rendered, the
 * Tuesday date generator the bucket probe walks, and the selection that keeps a
 * second run from re-downloading a season dump.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const grabMock = vi.fn();

vi.mock("grab-url", () => ({
  default: (...args: unknown[]) => grabMock(...args),
}));

const {
  downloadArchive,
  fetchCaselistDownloads,
  markSynced,
  probeArchives,
  recentArchiveDates,
  selectPendingArchives,
  syncCaselists,
} = await import("../src/caselist/caselist-sync");
const { archiveFromUrl, buildDownloads } = await import(
  "../src/caselist/downloads-page-parser"
);
const { HSPOLICY_DOWNLOADS_HTML, UNRENDERED_SHELL_HTML } = await import(
  "./caselist-downloads-fixture"
);

const ARCHIVE_URLS = [
  "https://caselist-files.s3.us-east-005.backblazeb2.com/weekly/hspolicy26/hspolicy26-all-2026-09-08.zip",
  "https://caselist-files.s3.us-east-005.backblazeb2.com/weekly/hspolicy26/hspolicy26-weekly-2026-09-08.zip",
];

describe("fetchCaselistDownloads", () => {
  beforeEach(() => {
    grabMock.mockReset();
    grabMock.mockResolvedValue({ error: "offline" });
  });

  it("uses markup the caller already rendered without any request", async () => {
    const result = await fetchCaselistDownloads("hspolicy26", {
      html: HSPOLICY_DOWNLOADS_HTML,
    });

    expect(result.source).toBe("html");
    expect(result.weekly).toHaveLength(5);
    expect(grabMock).not.toHaveBeenCalled();
  });

  it("prefers the API the page's own client calls", async () => {
    grabMock.mockResolvedValueOnce({ downloads: ARCHIVE_URLS });

    const result = await fetchCaselistDownloads("hspolicy26", { probe: false });

    expect(result.source).toBe("api");
    expect(result.all?.date).toBe("2026-09-08");
    expect(grabMock.mock.calls[0][0]).toContain("/caselists/hspolicy26/downloads");
    expect(grabMock.mock.calls[0][1]).toMatchObject({ cancelOngoingIfNew: false });
  });

  it("falls through to the page when the API answers with no archives", async () => {
    grabMock
      .mockResolvedValueOnce({ downloads: [] })
      .mockResolvedValueOnce({ downloads: [] })
      .mockResolvedValueOnce({ data: HSPOLICY_DOWNLOADS_HTML });

    const result = await fetchCaselistDownloads("hspolicy26", { probe: false });

    expect(result.source).toBe("html");
    expect(result.weekly).toHaveLength(5);
  });

  it("probes the bucket when the page is the un-rendered shell", async () => {
    // The case that motivates the whole fallback chain: a plain GET of a
    // client-rendered React app returns markup with no links in it.
    grabMock.mockResolvedValue({ data: UNRENDERED_SHELL_HTML });
    const fetchMock = vi
      .fn()
      .mockImplementation(async (url: string) => ({
        ok: url.includes("hspolicy26-weekly-2026-09-08.zip"),
      }));
    vi.stubGlobal("fetch", fetchMock);
    // Fake timers, not the real clock: the probe generates its candidate dates
    // from "now", so a real-clock run would assert a different week every week.
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-12T00:00:00Z"));

    const result = await fetchCaselistDownloads("hspolicy26", { probeWeeks: 2 });

    expect(result.source).toBe("probe");
    expect(result.weekly.map((archive) => archive.fileName)).toEqual([
      "hspolicy26-weekly-2026-09-08.zip",
    ]);
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ method: "HEAD" });
  });

  it("reports an empty manifest with its reasons instead of throwing", async () => {
    // One caselist being unreachable must not cost a five-caselist run the
    // other four, so nothing here rejects.
    grabMock.mockRejectedValue(new Error("ENOTFOUND"));
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("ENOTFOUND")));

    const result = await fetchCaselistDownloads("hspf26", { probeWeeks: 1 });

    expect(result.source).toBe("none");
    expect(result.all).toBeNull();
    expect(result.weekly).toEqual([]);
    expect(result.notes.join(" ")).toContain("ENOTFOUND");
  });

  it("normalizes a slug given as a URL", async () => {
    const result = await fetchCaselistDownloads("https://opencaselist.com/hsld26/downloads", {
      html: UNRENDERED_SHELL_HTML,
      probe: false,
    });

    expect(result.slug).toBe("hsld26");
    expect(result.label).toBe("HS LD 2026-27");
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });
});

describe("syncCaselists", () => {
  beforeEach(() => {
    grabMock.mockReset();
    grabMock.mockResolvedValue({ error: "offline" });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));
  });

  afterEach(() => vi.unstubAllGlobals());

  it("covers every caselist of the season by default", async () => {
    const results = await syncCaselists(undefined, { probe: false });

    expect(results.map((result) => result.slug)).toEqual([
      "hspolicy26",
      "hsld26",
      "hspf26",
      "ndtceda26",
      "nfald26",
    ]);
  });

  it("syncs only the caselists asked for", async () => {
    const results = await syncCaselists(["ndtceda26"], { probe: false });

    expect(results).toHaveLength(1);
    expect(results[0].label).toBe("NDT/CEDA College 2026-27");
  });
});

describe("recentArchiveDates", () => {
  it("counts back from the most recent Tuesday", () => {
    // Archives are cut at midnight every Tuesday morning.
    expect(recentArchiveDates(3, new Date("2026-09-12T12:00:00Z"))).toEqual([
      "2026-09-08",
      "2026-09-01",
      "2026-08-25",
    ]);
  });

  it("treats a Tuesday as its own most recent Tuesday", () => {
    expect(recentArchiveDates(1, new Date("2026-09-08T06:00:00Z"))).toEqual([
      "2026-09-08",
    ]);
  });

  it("is computed in UTC, not the runner's zone", () => {
    // The bucket names a date, not a moment; a local-clock derivation would
    // shift the whole list by a day west of Greenwich.
    expect(recentArchiveDates(1, new Date("2026-09-09T01:00:00Z"))).toEqual([
      "2026-09-08",
    ]);
  });

  it("returns nothing for a non-positive count", () => {
    expect(recentArchiveDates(0)).toEqual([]);
    expect(recentArchiveDates(-3)).toEqual([]);
  });
});

describe("probeArchives", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("keeps only the URLs that respond, newest first", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-12T00:00:00Z"));
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(async (url: string) => ({
        ok: url.includes("2026-09-08") || url.includes("weekly-2026-09-01"),
      })),
    );

    const found = await probeArchives("hsld26", { weeks: 3 });

    expect(found.map((archive) => archive.fileName)).toEqual([
      "hsld26-all-2026-09-08.zip",
      "hsld26-weekly-2026-09-08.zip",
      "hsld26-weekly-2026-09-01.zip",
    ]);
  });

  it("treats a network error as absence", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("reset")));

    expect(await probeArchives("hsld26", { weeks: 2 })).toEqual([]);
  });
});

describe("selectPendingArchives", () => {
  const downloads = buildDownloads(
    "hspolicy26",
    ARCHIVE_URLS.map((url) => archiveFromUrl(url)!),
  );

  it("seeds a fresh caselist from the season dump", () => {
    expect(selectPendingArchives(downloads, { synced: [] }).map((a) => a.kind)).toEqual([
      "all",
      "weekly",
    ]);
  });

  it("skips the dump once the caselist has been seeded", () => {
    // The weekly deltas carry the same files for a fraction of the bytes; a
    // re-download of the dump every Tuesday is the bug this prevents.
    const pending = selectPendingArchives(downloads, {
      synced: ["https://caselist-files.s3.us-east-005.backblazeb2.com/weekly/hspolicy26/hspolicy26-all-2026-09-01.zip"],
    });

    expect(pending.map((archive) => archive.kind)).toEqual(["weekly"]);
  });

  it("returns nothing when everything is already ingested", () => {
    expect(selectPendingArchives(downloads, { synced: ARCHIVE_URLS })).toEqual([]);
  });

  it("defaults to a full seed when given no state at all", () => {
    expect(selectPendingArchives(downloads)).toHaveLength(2);
  });
});

describe("markSynced", () => {
  it("adds archives without mutating the state it was given", () => {
    const state = { synced: [ARCHIVE_URLS[0]] };
    const next = markSynced(state, [archiveFromUrl(ARCHIVE_URLS[1])!]);

    expect(next.synced).toHaveLength(2);
    expect(next.updatedAt).toBeTruthy();
    expect(state.synced).toHaveLength(1);
  });

  it("is a no-op for an empty ingest", () => {
    const state = { synced: [] };

    expect(markSynced(state, [])).toBe(state);
  });
});

describe("downloadArchive", () => {
  const archive = archiveFromUrl(ARCHIVE_URLS[1])!;

  afterEach(() => vi.unstubAllGlobals());

  it("returns the archive's bytes", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        headers: new Headers({ "content-length": "4" }),
        arrayBuffer: async () => new ArrayBuffer(4),
      }),
    );

    expect((await downloadArchive(archive)).bytes.byteLength).toBe(4);
  });

  it("names the archive in a failed download", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 404, statusText: "Not Found" }),
    );

    await expect(downloadArchive(archive)).rejects.toThrow(
      /hspolicy26-weekly-2026-09-08\.zip failed: 404/,
    );
  });

  it("refuses an oversized archive on its declared length, before reading it", async () => {
    // A season dump is hundreds of megabytes; a caller with a memory ceiling
    // needs to bail on the header, not after buffering the body.
    const arrayBuffer = vi.fn();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        headers: new Headers({ "content-length": "999999999" }),
        arrayBuffer,
      }),
    );

    await expect(downloadArchive(archive, { maxBytes: 1024 })).rejects.toThrow(
      /over the 1024-byte limit/,
    );
    expect(arrayBuffer).not.toHaveBeenCalled();
  });

  it("still catches an oversized archive that declared no length", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        headers: new Headers(),
        arrayBuffer: async () => new ArrayBuffer(2048),
      }),
    );

    await expect(downloadArchive(archive, { maxBytes: 1024 })).rejects.toThrow(
      /over the 1024-byte limit/,
    );
  });
});
