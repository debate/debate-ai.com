import { describe, expect, it } from "vitest";
import {
  archiveFamilyOf,
  archiveKindOf,
  discoverCaselistArchives,
  extractArchiveLinks,
  isCrawlableCaselistRoute,
  planCaselistSync,
  selectLatestByFamily,
  sortArchivesNewestFirst,
  styleStartUrl,
  toCaselistArchives,
} from "../src/caselist/caselist-discovery";
import { archiveFromUrl, buildDownloads } from "../src/caselist/downloads-page-parser";
import { HSPOLICY_DOWNLOADS_HTML, forCaselist } from "./caselist-downloads-fixture";

const BUCKET = "https://caselist-files.s3.us-east-005.backblazeb2.com/weekly";

describe("archive naming", () => {
  it("classifies archives by file name", () => {
    expect(archiveKindOf("hspf26-all-2026-09-22.zip")).toBe("all");
    expect(archiveKindOf("hspf26-weekly-2026-09-22.zip")).toBe("weekly");
    expect(archiveKindOf("ndtceda26-open-source-2026-09-22.zip")).toBe("open-source");
    expect(archiveKindOf("ndtceda26-private-2026-09-22.zip")).toBe("private");
    expect(archiveKindOf("misc.zip")).toBe("other");
  });

  it("strips the date and extension to find the family", () => {
    expect(archiveFamilyOf(`${BUCKET}/hspf26/hspf26-all-2026-09-15.zip?x=1`)).toBe("hspf26-all");
    expect(archiveFamilyOf("HSPF26-Weekly-2026-09-15.zip")).toBe("hspf26-weekly");
    expect(archiveFamilyOf("undated.zip")).toBe("undated");
  });
});

describe("extractArchiveLinks", () => {
  it("reads only the ZIP links off a downloads page", () => {
    const archives = extractArchiveLinks(
      HSPOLICY_DOWNLOADS_HTML,
      "https://opencaselist.com/hspolicy26/downloads",
    );
    expect(archives).toHaveLength(6);
    expect(archives.every((archive) => archive.fileName.endsWith(".zip"))).toBe(true);
    expect(archives[0]).toMatchObject({ kind: "all", date: "2026-09-08", family: "hspolicy26-all" });
  });

  it("resolves relative hrefs against the page", () => {
    const [archive] = extractArchiveLinks(
      `<a href="/files/x-all-2026-01-06.zip">x</a>`,
      "https://opencaselist.com/x26",
    );
    expect(archive.url).toBe("https://opencaselist.com/files/x-all-2026-01-06.zip");
  });
});

describe("selectLatestByFamily", () => {
  it("keeps the newest archive of each family", () => {
    const archives = extractArchiveLinks(HSPOLICY_DOWNLOADS_HTML, "https://opencaselist.com/");
    const latest = selectLatestByFamily(archives);
    expect(latest.map((archive) => archive.fileName)).toEqual([
      "hspolicy26-all-2026-09-08.zip",
      "hspolicy26-weekly-2026-09-08.zip",
    ]);
  });

  it("sorts newest first with undated archives last", () => {
    const sorted = sortArchivesNewestFirst([
      { url: "a", fileName: "a.zip", date: null, kind: "other", family: "a", sourcePage: "" },
      { url: "b", fileName: "b.zip", date: "2026-01-01", kind: "other", family: "b", sourcePage: "" },
    ]);
    expect(sorted.map((archive) => archive.fileName)).toEqual(["b.zip", "a.zip"]);
  });
});

describe("isCrawlableCaselistRoute", () => {
  it("follows caselist roots and downloads pages only", () => {
    expect(isCrawlableCaselistRoute("https://opencaselist.com/ndtceda25")).toBe(true);
    expect(isCrawlableCaselistRoute("https://opencaselist.com/ndtceda25/downloads")).toBe(true);
    expect(isCrawlableCaselistRoute("https://opencaselist.com/hspolicy26/GlenbrookNorth")).toBe(false);
    expect(isCrawlableCaselistRoute("https://example.com/hspf26")).toBe(false);
  });
});

describe("discoverCaselistArchives", () => {
  it("reads the downloads page in the 5s style", async () => {
    const requested: string[] = [];
    const result = await discoverCaselistArchives("hspf26", "5s", {
      fetchHtml: async (url) => {
        requested.push(url);
        return forCaselist("hspf26", "HS PF 2026-27");
      },
    });
    expect(requested).toEqual(["https://opencaselist.com/hspf26/downloads"]);
    expect(result.archives).toHaveLength(6);
  });

  it("falls back to the all-years crawl when the downloads page is missing", async () => {
    const pages: Record<string, string> = {
      "https://opencaselist.com/ndtceda26": `<a href="/ndtceda25">last year</a><a href="/ndtceda26/School">school</a>`,
      "https://opencaselist.com/ndtceda25": `<a href="${BUCKET}/ndtceda25/ndtceda25-all-2026-06-30.zip">dump</a>`,
    };
    const result = await discoverCaselistArchives("ndtceda26", "5s", {
      fetchHtml: async (url) => {
        if (!(url in pages)) throw new Error("404");
        return pages[url];
      },
    });
    expect(result.archives.map((archive) => archive.fileName)).toEqual([
      "ndtceda25-all-2026-06-30.zip",
    ]);
    expect(result.pages).not.toContain("https://opencaselist.com/ndtceda26/School");
    expect(result.notes.some((note) => note.includes("falling back"))).toBe(true);
  });

  it("stops at the page budget", async () => {
    let count = 0;
    await discoverCaselistArchives("hspf26", "all", {
      maxPages: 3,
      fetchHtml: async () => {
        count += 1;
        return `<a href="/hspf${10 + count}">x</a><a href="/hspf${40 + count}">y</a>`;
      },
    });
    expect(count).toBe(3);
  });

  it("starts each style at its own page", () => {
    expect(styleStartUrl("hspf26", "5s")).toBe("https://opencaselist.com/hspf26/downloads");
    expect(styleStartUrl("hspf26", "all")).toBe("https://opencaselist.com/hspf26");
  });
});

describe("toCaselistArchives", () => {
  it("keeps only this caselist's bulk archives", () => {
    const archives = extractArchiveLinks(
      `<a href="${BUCKET}/hspf26/hspf26-all-2026-09-22.zip"></a>` +
        `<a href="${BUCKET}/hsld26/hsld26-all-2026-09-22.zip"></a>` +
        `<a href="https://x.test/misc.zip"></a>`,
      "https://opencaselist.com/hspf26",
    );
    expect(toCaselistArchives(archives, "hspf26").map((archive) => archive.fileName)).toEqual([
      "hspf26-all-2026-09-22.zip",
    ]);
  });
});

describe("planCaselistSync", () => {
  const url = (kind: string, date: string) => `${BUCKET}/hspf26/hspf26-${kind}-${date}.zip`;
  const downloads = buildDownloads(
    "hspf26",
    [
      url("all", "2026-09-15"),
      url("weekly", "2026-09-22"),
      url("weekly", "2026-09-15"),
      url("weekly", "2026-09-08"),
    ].map((archiveUrl) => archiveFromUrl(archiveUrl)!),
  );

  it("seeds from the dump plus weeklies cut after it", () => {
    expect(planCaselistSync(downloads, []).map((archive) => archive.fileName)).toEqual([
      "hspf26-all-2026-09-15.zip",
      "hspf26-weekly-2026-09-22.zip",
    ]);
  });

  it("imports only new weeklies once seeded", () => {
    const plan = planCaselistSync(downloads, ["hspf26-all-2026-09-08.zip", "other26-all-2026-09-22.zip"]);
    expect(plan.map((archive) => archive.fileName)).toEqual([
      "hspf26-weekly-2026-09-15.zip",
      "hspf26-weekly-2026-09-22.zip",
    ]);
  });

  it("returns nothing when the newest weekly is already imported", () => {
    expect(
      planCaselistSync(downloads, ["hspf26-all-2026-09-15.zip", "hspf26-weekly-2026-09-22.zip"]),
    ).toEqual([]);
  });

  it("uses every weekly when no dump is published yet", () => {
    const early = buildDownloads("hspf26", [archiveFromUrl(url("weekly", "2026-08-25"))!]);
    expect(planCaselistSync(early, [])).toHaveLength(1);
  });
});

describe("caselist-grab CLI helpers", async () => {
  const { applySelection, formatArchiveList, parseGrabArgs } = await import(
    "../src/caselist/caselist-grab-cli"
  );
  const archives = extractArchiveLinks(HSPOLICY_DOWNLOADS_HTML, "https://opencaselist.com/");

  it("parses flags", () => {
    expect(
      parseGrabArgs(["--caselist=hspf26", "--style=all", "--select=pick", "--pick=1,3", "--list"]),
    ).toMatchObject({ slug: "hspf26", style: "all", select: "pick", picks: [1, 3], list: true });
    expect(parseGrabArgs(["--style=bogus"]).style).toBeUndefined();
  });

  it("applies each selection", () => {
    expect(applySelection(archives, "latest")).toHaveLength(2);
    expect(applySelection(archives, "newest")).toHaveLength(1);
    expect(applySelection(archives, "all")).toHaveLength(6);
    expect(applySelection(archives, "pick", [1, 1, 99]).map((a) => a.fileName)).toEqual([
      "hspolicy26-all-2026-09-08.zip",
    ]);
  });

  it("numbers the list", () => {
    expect(formatArchiveList(archives)[0]).toBe(" 1. [all] 2026-09-08 — hspolicy26-all-2026-09-08.zip");
  });
});
