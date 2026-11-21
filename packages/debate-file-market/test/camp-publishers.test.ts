/**
 * @fileoverview The official camp publishers and reading one from a file name.
 */
import { describe, expect, it } from "vitest";
import {
  CAMP_PUBLISHERS,
  detectCampPublisher,
  findCampPublisher,
  findCampPublisherBySlug,
  publisherNameForFile,
  UNSORTED_PUBLISHER,
} from "../src/camp-publishers";

describe("CAMP_PUBLISHERS", () => {
  it("lists the 18 openev codes, each with a page slug, openev link and site", () => {
    expect(CAMP_PUBLISHERS.map((c) => c.code)).toEqual([
      "CNDI", "DDI", "ENDI", "GDI", "GDS", "HDC", "JDI", "KKB", "MGC",
      "MNDI", "MSDI", "NHSI", "RKS", "SA", "UM7", "UMC", "UTNIF", "WYO",
    ]);
    for (const camp of CAMP_PUBLISHERS) {
      expect(camp.slug).toBe(`camp-${camp.code.toLowerCase()}`);
      expect(camp.openevUrl).toBe(`https://opencaselist.com/openev/2026/${camp.code}`);
      expect(camp.website).toMatch(/^https:\/\//);
      expect(camp.location).toBeTruthy();
    }
  });

  it("finds a camp by code or slug", () => {
    expect(findCampPublisher("ddi")?.name).toContain("Dartmouth");
    expect(findCampPublisherBySlug("camp-mndi")?.code).toBe("MNDI");
    expect(findCampPublisherBySlug("westwood-lab")).toBeNull();
    expect(findCampPublisher(null)).toBeNull();
  });
});

describe("detectCampPublisher", () => {
  it.each([
    ["Spending DA - DDI 2026 RS.docx", "DDI"],
    ["K - Cap - GDS 2025.docx", "GDS"],
    ["Hege Good MNDI26", "MNDI"],
    ["Courts CP - UTNIF", "UTNIF"],
    ["Space Aff - UM7 2026 ABCD.docx", "UM7"],
    ["Elections DA - mgc.docx", "MGC"],
    ["Topicality - SA 2026", "SA"],
    ["Wyoming T - WYO 2026 v2 final.docx", "WYO"],
  ])("reads %s as %s", (name, code) => {
    expect(detectCampPublisher(name)?.code).toBe(code);
  });

  it("leaves files without a trailing code unsorted", () => {
    expect(detectCampPublisher("My own 1AC.docx")).toBeNull();
    expect(detectCampPublisher("Sa Aff")).toBeNull();
    expect(detectCampPublisher("DDI file with a long title about many other things")).toBeNull();
    expect(detectCampPublisher("")).toBeNull();
    expect(publisherNameForFile("Notes")).toBe(UNSORTED_PUBLISHER);
    expect(publisherNameForFile("Fed DA - ENDI 2026")).toContain("Emory");
  });
});
