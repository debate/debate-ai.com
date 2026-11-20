import { describe, expect, it } from "vitest";
import ndtHistory from "../data/ndt-school-history.json";
import { findTocSchoolRecord } from "../src/sync/toc-champions";
import { findNdcaSchoolRecord } from "../src/sync/ndca-champions";
import { findShirleySchoolResults } from "../src/sync/shirley-results";
import { findCedaSchoolTitles } from "../src/sync/ceda-champions";
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
    expect(honors.championships.parts.map((p) => p.label)).toEqual(["TOC", "NDCA"]);
  });

  it("is all zeros for a school with no national results", () => {
    const honors = highSchoolHonors("Nowhere Imaginary High School");
    expect([honors.championships.total, honors.finalists.total, honors.topSpeakers.total]).toEqual([0, 0, 0]);
    expect(honorHint(honors.championships)).toBeUndefined();
  });
});

describe("collegeHonors", () => {
  it("adds NDT, CEDA and Shirley titles and counts NDT finals and Shirley second places as finalists", () => {
    const ndt = schools.find((s) => s.school === "Northwestern University (IL)")!;
    const honors = collegeHonors("Northwestern University", ndt);
    const shirley = findShirleySchoolResults("Northwestern University");
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
