/**
 * @fileoverview Covers discovery and incremental state: archives come only
 * from the caselist's downloads page, read through the signed-in openCaselist
 * API, and the selection keeps a second run from re-downloading a season dump.
 */
import { afterEach, describe, expect, it, vi } from "vitest";

const {
  downloadArchive,
  fetchCaselistDownloads,
  caselistSessionFromEnv,
  markSynced,
  selectPendingArchives,
  syncCaselists,
} = await import("../../src/caselist/caselist-sync");
const { archiveFromUrl, buildDownloads } = await import(
  "../../src/caselist/downloads-page-parser"
);

const ARCHIVE_URLS = [
  "https://caselist-files.s3.us-east-005.backblazeb2.com/weekly/hspolicy26/hspolicy26-all-2026-09-08.zip",
  "https://caselist-files.s3.us-east-005.backblazeb2.com/weekly/hspolicy26/hspolicy26-weekly-2026-09-08.zip",
];

/** A fetch that answers the downloads endpoint and records every call. */
function apiFetch(body: unknown, status = 200) {
  return vi.fn(async (_url: string, _init?: RequestInit) =>
    new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } }),
  );
}

describe("fetchCaselistDownloads", () => {
  it("reads the downloads page's archives through the signed-in API, and nothing else", async () => {
    const fetchMock = apiFetch(ARCHIVE_URLS.map((url) => ({ name: url.split("/").pop(), url })));

    const result = await fetchCaselistDownloads("hspolicy26", { token: "tok", fetch: fetchMock as unknown as typeof fetch });

    expect(result.source).toBe("api");
    expect(result.all?.date).toBe("2026-09-08");
    expect(result.pageUrl).toBe("https://opencaselist.com/hspolicy26/downloads");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe("https://api.opencaselist.com/v1/caselists/hspolicy26/downloads");
    expect(new Headers(fetchMock.mock.calls[0][1]?.headers).get("Cookie")).toBe("caselist_token=tok");
  });

  it("takes the downloads page URL as the caselist", async () => {
    const fetchMock = apiFetch([{ path: "hspolicy26/hspolicy26-weekly-2026-09-08.zip" }]);

    const result = await fetchCaselistDownloads("https://opencaselist.com/hspolicy26/downloads", {
      token: "tok",
      fetch: fetchMock as unknown as typeof fetch,
    });

    expect(result.slug).toBe("hspolicy26");
    expect(result.weekly.map((archive) => archive.fileName)).toEqual(["hspolicy26-weekly-2026-09-08.zip"]);
    expect(fetchMock.mock.calls[0][0]).toContain("/caselists/hspolicy26/downloads");
  });

  it("asks for a session instead of fetching anonymously", async () => {
    const fetchMock = apiFetch([]);

    const result = await fetchCaselistDownloads("hspolicy26", { fetch: fetchMock as unknown as typeof fetch });

    expect(result.source).toBe("none");
    expect(result.notes.join(" ")).toContain("OPENCASELIST_API_KEY");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("reports a refused session or an outage instead of throwing", async () => {
    const refused = await fetchCaselistDownloads("hspf26", {
      token: "old",
      fetch: apiFetch({ message: "Unauthorized" }, 401) as unknown as typeof fetch,
    });
    expect(refused.source).toBe("none");
    expect(refused.notes.join(" ")).toContain("refused");

    const down = await fetchCaselistDownloads("hspf26", {
      token: "tok",
      fetch: vi.fn().mockRejectedValue(new Error("ENOTFOUND")) as unknown as typeof fetch,
    });
    expect(down.source).toBe("none");
    expect(down.all).toBeNull();
    expect(down.notes.join(" ")).toContain("ENOTFOUND");
  });

  it("reads the session from the environment", () => {
    expect(caselistSessionFromEnv({ OPENCASELIST_API_KEY: " t " })).toEqual({ token: "t", username: undefined, password: undefined });
  });
});

describe("syncCaselists", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("covers every caselist of the season by default", async () => {
    const results = await syncCaselists(undefined, { token: "tok", fetch: apiFetch([]) as unknown as typeof fetch });

    expect(results.map((result) => result.slug)).toEqual([
      "hspolicy26",
      "hsld26",
      "hspf26",
      "ndtceda26",
      "nfald26",
    ]);
  });

  it("syncs only the caselists asked for", async () => {
    const results = await syncCaselists(["ndtceda26"], { token: "tok", fetch: apiFetch([]) as unknown as typeof fetch });

    expect(results).toHaveLength(1);
    expect(results[0].label).toBe("NDT/CEDA College 2026-27");
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
