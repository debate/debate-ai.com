/**
 * @fileoverview Covers the caselist catalog — the slug ↔ caselist mapping every
 * other part of the sync is parameterized by, and the bucket URL shape that is
 * written down in exactly one place.
 */
import { describe, expect, it } from "vitest";

import {
  CURRENT_SEASON,
  archiveUrl,
  caselistFor,
  caselistsForSeason,
  downloadsPageUrl,
  parseCaselistSlug,
  seasonLabel,
} from "../src/caselist/caselist-config";

describe("caselistsForSeason", () => {
  it("covers every caselist openCaselist runs", () => {
    expect(caselistsForSeason().map((caselist) => caselist.slug)).toEqual([
      "hspolicy26",
      "hsld26",
      "hspf26",
      "ndtceda26",
      "nfald26",
    ]);
  });

  it("rolls forward to another season without a code change", () => {
    expect(caselistsForSeason(27).map((caselist) => caselist.slug)).toContain("hsld27");
    expect(caselistFor("hspolicy", 25)?.label).toBe("HS Policy 2025-26");
  });

  it("labels the college caselists as college", () => {
    const byLevel = Object.fromEntries(
      caselistsForSeason().map((caselist) => [caselist.slug, caselist.level]),
    );

    expect(byLevel).toMatchObject({
      hspolicy26: "hs",
      ndtceda26: "college",
      nfald26: "college",
    });
  });
});

describe("seasonLabel", () => {
  it.each([
    [26, "2026-27"],
    [25, "2025-26"],
    [99, "2099-00"],
  ])("expands %i to %s", (season, label) => {
    expect(seasonLabel(season)).toBe(label);
  });
});

describe("parseCaselistSlug", () => {
  it("reads a bare slug", () => {
    expect(parseCaselistSlug("ndtceda26")).toMatchObject({
      slug: "ndtceda26",
      event: "policy",
      level: "college",
      year: 2026,
    });
  });

  it.each([
    "https://opencaselist.com/hsld26/downloads",
    "/hsld26/downloads",
    "hsld26/",
    "  hsld26  ",
  ])("reads %s", (input) => {
    expect(parseCaselistSlug(input)?.slug).toBe("hsld26");
  });

  it("returns null for a family openCaselist does not run", () => {
    expect(parseCaselistSlug("hsparli26")).toBeNull();
    expect(parseCaselistSlug("")).toBeNull();
  });
});

describe("archiveUrl", () => {
  it("puts both kinds under the same weekly/ prefix", () => {
    // The season dump lives under `weekly/` too — a detail worth pinning,
    // since the obvious guess (`all/…`) 404s.
    expect(archiveUrl("hspolicy26", "all", "2026-09-08")).toBe(
      "https://caselist-files.s3.us-east-005.backblazeb2.com/weekly/hspolicy26/hspolicy26-all-2026-09-08.zip",
    );
    expect(archiveUrl("hspf26", "weekly", "2026-09-01")).toBe(
      "https://caselist-files.s3.us-east-005.backblazeb2.com/weekly/hspf26/hspf26-weekly-2026-09-01.zip",
    );
  });
});

describe("downloadsPageUrl", () => {
  it("is the page the user browses", () => {
    expect(downloadsPageUrl(`nfald${CURRENT_SEASON}`)).toBe(
      "https://opencaselist.com/nfald26/downloads",
    );
  });
});
