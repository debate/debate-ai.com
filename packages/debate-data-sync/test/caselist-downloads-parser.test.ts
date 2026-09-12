/**
 * @fileoverview Covers the pure half of the openCaselist sync: reading a
 * rendered downloads page, or the API payload behind it, into an archive
 * manifest.
 *
 * The page is a client-rendered React app with hashed CSS-module class names
 * and no stable ids, so these tests pin the two properties the parser actually
 * relies on — that archives are identified by their file names, and that the
 * page's many non-archive links are ignored — rather than any markup shape.
 */
import { describe, expect, it } from "vitest";

import {
  archiveFromUrl,
  buildDownloads,
  listArchives,
  parseArchiveFileName,
  parseDownloadsHtml,
  parseDownloadsPayload,
} from "../src/caselist/downloads-page-parser";
import {
  HSPOLICY_DOWNLOADS_HTML,
  UNRENDERED_SHELL_HTML,
  forCaselist,
} from "./caselist-downloads-fixture";

describe("parseArchiveFileName", () => {
  it("reads the slug, kind and date out of an archive name", () => {
    expect(parseArchiveFileName("hspolicy26-weekly-2026-09-08.zip")).toEqual({
      slug: "hspolicy26",
      kind: "weekly",
      date: "2026-09-08",
    });
  });

  it("reads a name off the end of a full URL, query string and all", () => {
    expect(
      parseArchiveFileName(
        "https://caselist-files.s3.us-east-005.backblazeb2.com/weekly/ndtceda26/ndtceda26-all-2026-09-08.zip?x=1",
      ),
    ).toMatchObject({ slug: "ndtceda26", kind: "all", date: "2026-09-08" });
  });

  it("rejects anything that is not an archive name", () => {
    expect(parseArchiveFileName("/hspolicy26/downloads")).toBeNull();
    expect(parseArchiveFileName("hspolicy26-weekly.zip")).toBeNull();
    expect(parseArchiveFileName("hspolicy26-all-2026-09-08.docx")).toBeNull();
  });
});

describe("archiveFromUrl", () => {
  it("rebuilds the bucket URL for a bare file name", () => {
    expect(archiveFromUrl("hsld26-weekly-2026-09-08.zip")?.url).toBe(
      "https://caselist-files.s3.us-east-005.backblazeb2.com/weekly/hsld26/hsld26-weekly-2026-09-08.zip",
    );
  });

  it("keeps an absolute URL as given", () => {
    const url =
      "https://caselist-files.s3.us-east-005.backblazeb2.com/weekly/hspf26/hspf26-all-2026-09-08.zip";
    expect(archiveFromUrl(url)?.url).toBe(url);
  });
});

describe("parseDownloadsHtml", () => {
  const downloads = parseDownloadsHtml(HSPOLICY_DOWNLOADS_HTML, "hspolicy26");

  it("picks up the season dump", () => {
    expect(downloads.all).toMatchObject({
      fileName: "hspolicy26-all-2026-09-08.zip",
      kind: "all",
      date: "2026-09-08",
    });
  });

  it("picks up every weekly archive, newest first", () => {
    expect(downloads.weekly.map((archive) => archive.date)).toEqual([
      "2026-09-08",
      "2026-09-01",
      "2026-08-25",
      "2026-08-18",
      "2026-07-07",
    ]);
  });

  it("ignores the page's school, nav and footer links", () => {
    // The sidebar alone links ~250 schools plus /recent and /downloads, and the
    // footer links off-site; none of them are archives.
    expect(listArchives(downloads).every((archive) => archive.url.endsWith(".zip"))).toBe(
      true,
    );
    expect(listArchives(downloads)).toHaveLength(6);
  });

  it("takes the label off the page's heading", () => {
    expect(downloads.label).toBe("HS Policy 2026-27");
  });

  it("infers the caselist from the archives when no slug is given", () => {
    expect(parseDownloadsHtml(HSPOLICY_DOWNLOADS_HTML).slug).toBe("hspolicy26");
  });

  it.each([
    ["ndtceda26", "NDT/CEDA College 2026-27"],
    ["hsld26", "HS LD 2026-27"],
    ["hspf26", "HS PF 2026-27"],
    ["nfald26", "NFA College LD 2026-27"],
  ])("parses %s, which serves the same markup", (slug, label) => {
    const parsed = parseDownloadsHtml(forCaselist(slug, label), slug);

    expect(parsed.slug).toBe(slug);
    expect(parsed.label).toBe(label);
    expect(parsed.all?.fileName).toBe(`${slug}-all-2026-09-08.zip`);
    expect(parsed.weekly).toHaveLength(5);
    expect(parsed.weekly[0].url).toContain(`/weekly/${slug}/`);
  });

  it("drops a stray link to another caselist's archive", () => {
    const html = `${HSPOLICY_DOWNLOADS_HTML}<a href="https://caselist-files.s3.us-east-005.backblazeb2.com/weekly/hsld26/hsld26-all-2026-09-08.zip">x</a>`;

    expect(
      listArchives(parseDownloadsHtml(html, "hspolicy26")).every(
        (archive) => archive.slug === "hspolicy26",
      ),
    ).toBe(true);
  });

  it("returns empty lists for the un-rendered shell rather than throwing", () => {
    // A plain GET returns this. "No archives" has to be a value the caller can
    // act on — it is what makes the fetcher fall through to its next source.
    const parsed = parseDownloadsHtml(UNRENDERED_SHELL_HTML, "hspolicy26");

    expect(parsed.all).toBeNull();
    expect(parsed.weekly).toEqual([]);
    expect(parsed.label).toBe("HS Policy 2026-27");
  });
});

describe("parseDownloadsPayload", () => {
  const urls = [
    "https://caselist-files.s3.us-east-005.backblazeb2.com/weekly/hsld26/hsld26-all-2026-09-08.zip",
    "https://caselist-files.s3.us-east-005.backblazeb2.com/weekly/hsld26/hsld26-weekly-2026-09-08.zip",
  ];

  it.each([
    ["a bare array of URLs", urls],
    ["objects under downloads", { downloads: urls.map((url) => ({ url })) }],
    ["objects under files", { files: urls.map((url) => ({ file: url })) }],
    ["objects under data", { data: urls.map((url) => ({ name: url })) }],
  ])("reads %s", (_label, payload) => {
    const parsed = parseDownloadsPayload(payload, "hsld26");

    expect(parsed.all?.date).toBe("2026-09-08");
    expect(parsed.weekly).toHaveLength(1);
  });

  it("yields an empty manifest for a payload with no archives", () => {
    expect(listArchives(parseDownloadsPayload({ error: "nope" }, "hsld26"))).toEqual([]);
  });
});

describe("buildDownloads", () => {
  it("de-duplicates an archive linked twice", () => {
    const archive = archiveFromUrl("hspf26-weekly-2026-09-08.zip")!;

    expect(buildDownloads("hspf26", [archive, { ...archive }]).weekly).toHaveLength(1);
  });

  it("keeps the newest dump when a page lists more than one", () => {
    const older = archiveFromUrl("hspf26-all-2026-09-01.zip")!;
    const newer = archiveFromUrl("hspf26-all-2026-09-08.zip")!;

    expect(buildDownloads("hspf26", [older, newer]).all?.date).toBe("2026-09-08");
  });

  it("falls back to the catalog label when no page heading was read", () => {
    expect(buildDownloads("nfald26", []).label).toBe("NFA College LD 2026-27");
  });
});
