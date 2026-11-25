import { describe, expect, it } from "vitest";
import ndtHistory from "../data/ndt-school-history.json";
import { findTocSchoolRecord } from "../src/sync/toc-champions";
import { findNdcaSchoolRecord } from "../src/sync/ndca-champions";
import { findListedShirleyResults } from "../src/sync/shirley-results";
import { findCedaSchoolTitles } from "../src/sync/ceda-champions";
import { CAL_RESULTS, findCalSchoolResults } from "../src/sync/berkeley-champions";
import type { NdtSchoolHistory } from "../src/sync/ndt-school-history";
import { collegeHonors, highSchoolHonors, honorHint } from "../src/leaderboard/profile/schoolHonors";

const schools = ((ndtHistory as { schools?: unknown }).schools ?? ndtHistory) as NdtSchoolHistory[];

describe("highSchoolHonors", () => {
  it("adds TOC and NDCA championships, second places and top speakers", () => {
    const school = "Greenhill";
    const toc = findTocSchoolRecord(school)!;
    const ndca = findNdcaSchoolRecord(school)!;
    const honors = highSchoolHonors(school);
    expect(honors.championships.total).toBe(toc.titles + ndca.titles);
    expect(honors.finalists.total).toBe(toc.runnerUps + ndca.results.filter((r) => r.place === "Finalist").length);
    expect(honors.topSpeakers.total).toBe(toc.topSpeakers + ndca.topSpeakers);
    expect(honors.championships.parts.map((p) => p.label)).toEqual(["TOC", "NDCA", "Cal"]);
  });

  it("counts Cal Invitational (UC Berkeley) LD and PF wins as championships", () => {
    const school = "Harvard-Westlake School";
    const toc = findTocSchoolRecord(school);
    const ndca = findNdcaSchoolRecord(school);
    const honors = highSchoolHonors(school);
    expect(honors.championships.parts.find((p) => p.label === "Cal")?.count).toBe(3);
    expect(honors.championships.total).toBe((toc?.titles ?? 0) + (ndca?.titles ?? 0) + 3);
    expect(honorHint(honors.championships)).toContain("3 Cal");
    const nueva = highSchoolHonors("Nueva School");
    expect(nueva.championships.parts.find((p) => p.label === "Cal")?.count).toBe(2);
  });

  it("is all zeros for a school with no national results", () => {
    const honors = highSchoolHonors("Nowhere Imaginary High School");
    expect([honors.championships.total, honors.finalists.total, honors.topSpeakers.total]).toEqual([0, 0, 0]);
    expect(honorHint(honors.championships)).toBeUndefined();
  });
});

describe("collegeHonors", () => {
  it("adds NDT, CEDA and 2000-on Shirley titles and counts NDT finals and Shirley second places as finalists", () => {
    const ndt = schools.find((s) => s.school === "Northwestern University (IL)")!;
    const honors = collegeHonors("Northwestern University", ndt);
    const shirley = findListedShirleyResults("Northwestern University");
    const ceda = findCedaSchoolTitles("Northwestern University");
    expect(honors.championships.total).toBe(
      ndt.championships.length + (ceda?.titles.length ?? 0) + (shirley?.championships ?? 0),
    );
    expect(honors.finalists.total).toBe(
      ndt.elims.filter((e) => e.round === "Finals").length + (shirley?.secondPlaces ?? 0),
    );
    expect(honors.topSpeakers.total).toBe(ndt.speakerAwards.filter((a) => a.rank === 1).length);
    expect(honors.finalists.total).toBeGreaterThan(0);
  });
});

describe("honorHint", () => {
  it("lists only the tournaments with a count", () => {
    expect(
      honorHint({ total: 4, parts: [{ label: "NDT", count: 3 }, { label: "CEDA", count: 0 }, { label: "Shirley", count: 1 }] }),
    ).toBe("3 NDT · 1 Shirley");
  });
});

describe("Cal Invitational results", () => {
  it("records LD and PF only, one champion per event and year", () => {
    expect(new Set(CAL_RESULTS.map((r) => r.event))).toEqual(new Set(["Lincoln-Douglas", "Public Forum"]));
    const champions = CAL_RESULTS.filter((r) => r.place === "Champion").map((r) => `${r.year} ${r.event}`);
    expect(new Set(champions).size).toBe(champions.length);
  });

  it("finds a school's Cal results by name", () => {
    expect(findCalSchoolResults("Millburn High School").map((r) => r.competitors)).toEqual(["Brian Zhu & James Chen"]);
    expect(findCalSchoolResults("Nowhere Imaginary High School")).toEqual([]);
  });
});
