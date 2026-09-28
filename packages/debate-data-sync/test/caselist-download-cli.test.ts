/**
 * @fileoverview The ZIP selector behind `download-caselist`: the menu's
 * answers (A / W / R / a number / a date), the flags that answer it
 * non-interactively, and what each selection resolves to.
 */
import { describe, expect, it } from "vitest";
import {
  parseDownloadArgs,
  parseSelection,
  seasonProbeWeeks,
  selectArchives,
} from "../src/caselist/caselist-download-cli";
import { parseDownloadsHtml } from "../src/caselist/downloads-page-parser";
import { HSPOLICY_DOWNLOADS_HTML } from "./caselist-downloads-fixture";

const downloads = parseDownloadsHtml(HSPOLICY_DOWNLOADS_HTML, "hspolicy26");
const names = (archives: { fileName: string }[]) => archives.map((archive) => archive.fileName);

describe("parseSelection", () => {
  it.each([
    ["A", { mode: "all" }],
    [" w ", { mode: "weekly" }],
    ["r", { mode: "range" }],
    ["3", { mode: "index", index: 2 }],
    ["2026-09-01", { mode: "date", date: "2026-09-01" }],
  ])("reads %j", (answer, selection) => {
    expect(parseSelection(answer)).toEqual(selection);
  });

  it("rejects answers the menu doesn't offer", () => {
    expect(parseSelection("0")).toBeNull();
    expect(parseSelection("x")).toBeNull();
    expect(parseSelection("")).toBeNull();
  });
});

describe("selectArchives", () => {
  it("A picks the all-files archive", () => {
    expect(names(selectArchives(downloads, { mode: "all" }))).toEqual(["hspolicy26-all-2026-09-08.zip"]);
  });

  it("W picks every weekly archive, newest first", () => {
    expect(names(selectArchives(downloads, { mode: "weekly" }))).toEqual([
      "hspolicy26-weekly-2026-09-08.zip",
      "hspolicy26-weekly-2026-09-01.zip",
      "hspolicy26-weekly-2026-08-25.zip",
      "hspolicy26-weekly-2026-08-18.zip",
      "hspolicy26-weekly-2026-07-07.zip",
    ]);
  });

  it("R keeps weekly archives within inclusive bounds, either of which may be open", () => {
    expect(names(selectArchives(downloads, { mode: "range", from: "2026-08-18", to: "2026-09-01" }))).toEqual([
      "hspolicy26-weekly-2026-09-01.zip",
      "hspolicy26-weekly-2026-08-25.zip",
      "hspolicy26-weekly-2026-08-18.zip",
    ]);
    expect(selectArchives(downloads, { mode: "range", to: "2026-08-01" })).toHaveLength(1);
    expect(selectArchives(downloads, { mode: "range" })).toHaveLength(5);
    expect(() => selectArchives(downloads, { mode: "range", from: "Aug 1" })).toThrow(/YYYY-MM-DD/);
  });

  it("a number or a date picks one weekly archive", () => {
    expect(names(selectArchives(downloads, { mode: "index", index: 1 }))).toEqual([
      "hspolicy26-weekly-2026-09-01.zip",
    ]);
    expect(names(selectArchives(downloads, { mode: "date", date: "2026-07-07" }))).toEqual([
      "hspolicy26-weekly-2026-07-07.zip",
    ]);
    expect(() => selectArchives(downloads, { mode: "index", index: 9 })).toThrow(/#10/);
    expect(() => selectArchives(downloads, { mode: "date", date: "2026-07-14" })).toThrow(/2026-07-14/);
  });

  it("A fails clearly when a caselist has no season dump", () => {
    expect(() => selectArchives({ ...downloads, all: null }, { mode: "all" })).toThrow(/all-files/);
  });
});

describe("parseDownloadArgs", () => {
  it("defaults to the current HS Policy caselist, asking interactively", () => {
    const options = parseDownloadArgs([]);
    expect(options.slug).toBe("hspolicy26");
    expect(options.selection).toBeUndefined();
    expect(options.outDir).toBe(".");
    expect(options.dryRun).toBe(false);
  });

  it("answers the menu from flags", () => {
    expect(parseDownloadArgs(["--select=r", "--from=2026-08-01", "--to", "2026-09-22"]).selection).toEqual({
      mode: "range",
      from: "2026-08-01",
      to: "2026-09-22",
    });
    expect(parseDownloadArgs(["--from=2026-08-01"]).selection).toEqual({ mode: "range", from: "2026-08-01" });
    const options = parseDownloadArgs(["--caselist=hsld26", "--select", "a", "--out=zips", "--dry-run"]);
    expect(options).toMatchObject({ slug: "hsld26", selection: { mode: "all" }, outDir: "zips", dryRun: true });
  });

  it("rejects a --select the menu doesn't offer", () => {
    expect(() => parseDownloadArgs(["--select=everything"])).toThrow(/--select=everything/);
  });
});

describe("seasonProbeWeeks", () => {
  it("reaches back to July 1 of the caselist's season", () => {
    // 2026-07-01 → 2026-09-23 is 12 weeks; one more covers the first Tuesday.
    expect(seasonProbeWeeks("hspolicy26", new Date("2026-09-23T00:00:00Z"))).toBe(13);
  });

  it("never probes less than the sync's 8 weeks nor more than a year", () => {
    expect(seasonProbeWeeks("hspolicy26", new Date("2026-07-02T00:00:00Z"))).toBe(8);
    expect(seasonProbeWeeks("hspolicy24", new Date("2026-09-23T00:00:00Z"))).toBe(53);
    expect(seasonProbeWeeks("not-a-caselist")).toBe(8);
  });
});
