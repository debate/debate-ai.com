/**
 * @fileoverview Covers the sync CLI's argument handling and the manifest it
 * writes — in particular that the manifest doubles as sync state, carrying a
 * caselist's already-ingested archives across runs.
 */
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const grabMock = vi.fn();

vi.mock("grab-url", () => ({
  default: (...args: unknown[]) => grabMock(...args),
}));

const { parseArgs, run } = await import("../src/caselist/caselist-sync-cli");
const { HSPOLICY_DOWNLOADS_HTML } = await import("./caselist-downloads-fixture");

describe("parseArgs", () => {
  it("defaults to every caselist of the season", () => {
    expect(parseArgs([]).slugs).toEqual([
      "hspolicy26",
      "hsld26",
      "hspf26",
      "ndtceda26",
      "nfald26",
    ]);
  });

  it.each([
    [["--caselist=hsld26"], ["hsld26"]],
    [["--caselist", "hsld26"], ["hsld26"]],
    [["--caselist=hsld26,ndtceda26"], ["hsld26", "ndtceda26"]],
  ])("reads %j", (argv, slugs) => {
    expect(parseArgs(argv).slugs).toEqual(slugs);
  });

  it("reads the run's flags", () => {
    const options = parseArgs(["--ingest", "--cards", "--no-probe", "--limit=25"]);

    expect(options).toMatchObject({
      ingest: true,
      cards: true,
      probe: false,
      limit: 25,
      dryRun: false,
    });
  });

  it("reads --html-file", () => {
    expect(parseArgs(["--html-file=page.html"]).htmlFile).toBe("page.html");
  });

  it("discovers only, by default", () => {
    // Discovery is cheap and ingest is not; a bare run must not start
    // downloading hundreds of megabytes.
    expect(parseArgs([])).toMatchObject({ ingest: false, cards: false, probe: true });
  });
});

describe("run", () => {
  let directory: string;
  let manifestPath: string;

  beforeEach(async () => {
    directory = await fs.mkdtemp(path.join(os.tmpdir(), "caselist-sync-"));
    manifestPath = path.join(directory, "caselist-downloads.json");
    grabMock.mockReset();
    grabMock.mockResolvedValue({ data: HSPOLICY_DOWNLOADS_HTML });
    vi.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await fs.rm(directory, { recursive: true, force: true });
  });

  it("writes a manifest of the archives it found", async () => {
    await run(["--caselist=hspolicy26", "--no-probe", `--out=${manifestPath}`]);

    const manifest = JSON.parse(await fs.readFile(manifestPath, "utf8"));

    expect(manifest.caselists.hspolicy26).toMatchObject({
      label: "HS Policy 2026-27",
      pageUrl: "https://opencaselist.com/hspolicy26/downloads",
      source: "html",
      synced: [],
    });
    expect(manifest.caselists.hspolicy26.weekly).toHaveLength(5);
    expect(manifest.caselists.hspolicy26.all.fileName).toBe(
      "hspolicy26-all-2026-09-08.zip",
    );
  });

  it("keeps what an earlier run ingested when it refreshes", async () => {
    const synced = [
      "https://caselist-files.s3.us-east-005.backblazeb2.com/weekly/hspolicy26/hspolicy26-all-2026-09-08.zip",
    ];
    await fs.writeFile(
      manifestPath,
      JSON.stringify({
        updatedAt: "2026-09-09T00:00:00.000Z",
        caselists: { hspolicy26: { slug: "hspolicy26", synced } },
      }),
    );

    await run(["--caselist=hspolicy26", "--no-probe", `--out=${manifestPath}`]);

    const manifest = JSON.parse(await fs.readFile(manifestPath, "utf8"));

    expect(manifest.caselists.hspolicy26.synced).toEqual(synced);
  });

  it("writes nothing under --dry-run", async () => {
    const manifest = await run([
      "--caselist=hspolicy26",
      "--no-probe",
      "--dry-run",
      `--out=${manifestPath}`,
    ]);

    expect(manifest.caselists.hspolicy26.weekly).toHaveLength(5);
    await expect(fs.readFile(manifestPath, "utf8")).rejects.toThrow();
  });

  it("reads a saved page instead of making any request", async () => {
    // The escape hatch for the page being client-rendered: markup captured from
    // a browser, read straight off disk.
    const pagePath = path.join(directory, "page.html");
    await fs.writeFile(pagePath, HSPOLICY_DOWNLOADS_HTML);

    await run([
      "--caselist=hspolicy26",
      `--html-file=${pagePath}`,
      `--out=${manifestPath}`,
    ]);

    const manifest = JSON.parse(await fs.readFile(manifestPath, "utf8"));

    expect(manifest.caselists.hspolicy26.weekly).toHaveLength(5);
    expect(grabMock).not.toHaveBeenCalled();
  });

  it("refuses saved markup for more than one caselist", async () => {
    // One page's archives credited to five caselists would be silent corruption.
    const pagePath = path.join(directory, "page.html");
    await fs.writeFile(pagePath, HSPOLICY_DOWNLOADS_HTML);

    await expect(run([`--html-file=${pagePath}`, `--out=${manifestPath}`])).rejects.toThrow(
      /one caselist/,
    );
  });

  it("starts from an empty manifest when the file is unreadable", async () => {
    await fs.writeFile(manifestPath, "{ not json");

    await run(["--caselist=hspolicy26", "--no-probe", `--out=${manifestPath}`]);

    const manifest = JSON.parse(await fs.readFile(manifestPath, "utf8"));

    expect(manifest.caselists.hspolicy26.slug).toBe("hspolicy26");
  });
});
