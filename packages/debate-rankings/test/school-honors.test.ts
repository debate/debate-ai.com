import { describe, expect, it } from "vitest";
import ndtHistory from "../data/ndt-school-history.json";
import { findTocSchoolRecord } from "../src/sync/toc-champions";
import { findNdcaSchoolRecord } from "../src/sync/ndca-champions";
import { findListedShirleyResults } from "../src/sync/shirley-results";
import { findCedaSchoolTitles } from "../src/sync/ceda-champions";
import { findBarkleySchoolResults } from "../src/sync/barkley-champions";
import { CAL_RESULTS, findCalSchoolResults } from "../src/sync/berkeley-champions";
import { GLENBROOKS_RESULTS, findGlenbrooksSchoolResults, isGlenbrooksTitle } from "../src/sync/glenbrooks-champions";
import type { NdtSchoolHistory } from "../src/sync/ndt-school-history";
import { collegeChampionshipsSince, collegeHonors, highSchoolHonors, honorHint } from "../src/leaderboard/profile/schoolHonors";

const schools = ((ndtHistory as { schools?: unknown }).schools ?? ndtHistory) as NdtSchoolHistory[];

describe("highSchoolHonors", () => {
  it("adds TOC and NDCA championships, second places and top speakers", () => {
    const school = "Greenhill";
    const toc = findTocSchoolRecord(school)!;
    const ndca = findNdcaSchoolRecord(school)!;
    const glenbrooks = findGlenbrooksSchoolResults(school);
    const barkley = findBarkleySchoolResults(school);
    const cal = findCalSchoolResults(school);
    const honors = highSchoolHonors(school);
    const g = (place: string) => glenbrooks.filter((r) => r.place === place).length;
    const b = (place: string) => barkley.filter((r) => r.place === place).length;
    const c = (place: string) => cal.filter((r) => r.place === place).length;
    expect(honors.championships.total).toBe(
      toc.titles + ndca.titles + b("Champion") + c("Champion") + glenbrooks.filter(isGlenbrooksTitle).length,
    );
    expect(honors.finalists.total).toBe(
      toc.runnerUps + ndca.results.filter((r) => r.place === "Finalist").length + b("Finalist") + c("Finalist") + g("Finalist"),
    );
    expect(honors.topSpeakers.total).toBe(toc.topSpeakers + ndca.topSpeakers + b("Top speaker") + c("Top speaker") + g("Top speaker"));
    for (const total of [honors.championships, honors.finalists, honors.topSpeakers]) {
      expect(total.parts.map((p) => p.label)).toEqual(["TOC", "NDCA", "Barkley", "Cal", "Glenbrooks"]);
      expect(total.total).toBe(total.parts.reduce((sum, p) => sum + p.count, 0));
    }
  });

  it("counts Cal Invitational (UC Berkeley) LD and PF wins as championships", () => {
    const school = "Harvard-Westlake School";
    const toc = findTocSchoolRecord(school);
    const ndca = findNdcaSchoolRecord(school);
    const honors = highSchoolHonors(school);
    expect(honors.championships.parts.find((p) => p.label === "Cal")?.count).toBe(3);
    const barkleyTitles = findBarkleySchoolResults(school).filter((r) => r.place === "Champion").length;
    expect(honors.championships.total).toBe((toc?.titles ?? 0) + (ndca?.titles ?? 0) + barkleyTitles + 3 + 1);
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

describe("Glenbrooks results", () => {
  it("counts Glenbrooks titles, finalists and top speakers on high school pages", () => {
    const greenhill = highSchoolHonors("Greenhill School (TX)");
    // Policy 2000, 2006, 2011, 2012, 2018 and LD 2004, 2012, 2015.
    expect(greenhill.championships.parts.find((p) => p.label === "Glenbrooks")?.count).toBe(8);
    expect(honorHint(greenhill.championships)).toContain("8 Glenbrooks");
    // A close-out credits both co-champions, as the TOC does.
    expect(highSchoolHonors("Edina High School (MN)").championships.parts.find((p) => p.label === "Glenbrooks")?.count).toBe(4);
    expect(highSchoolHonors("Strake Jesuit College Preparatory").finalists.parts.find((p) => p.label === "Glenbrooks")?.count).toBe(2);
  });

  it("records Varsity Policy, LD and PF only, one title per event and year", () => {
    expect(new Set(GLENBROOKS_RESULTS.map((r) => r.event))).toEqual(new Set(["Policy", "Lincoln-Douglas", "Public Forum"]));
    const champions = GLENBROOKS_RESULTS.filter((r) => r.place === "Champion").map((r) => `${r.year} ${r.event}`);
    expect(new Set(champions).size).toBe(champions.length);
    const coChampionYears = GLENBROOKS_RESULTS.filter((r) => r.place === "Co-champion").map((r) => `${r.year} ${r.event}`);
    expect(coChampionYears.some((key) => champions.includes(key))).toBe(false);
    expect(GLENBROOKS_RESULTS.some((r) => r.year === 2026)).toBe(false);
  });

  it("flags inferred results as probable", () => {
    const probable = GLENBROOKS_RESULTS.filter((r) => r.probable).map((r) => `${r.year} ${r.event} ${r.place}`);
    expect(probable).toEqual(expect.arrayContaining(["2025 Policy Champion", "2024 Lincoln-Douglas Champion", "2015 Policy Champion"]));
    expect(GLENBROOKS_RESULTS.find((r) => r.year === 2024 && r.event === "Lincoln-Douglas" && r.place === "Finalist")?.probable).toBeUndefined();
  });
});

describe("Barkley Forum honors", () => {
  it("counts Barkley champions, finalists and top speakers on high school pages", () => {
    const strake = highSchoolHonors("Strake Jesuit College Preparatory");
    // PF 2022, 2023, 2026 and LD 2023 champions; PF top speakers 2024 and 2025.
    expect(strake.championships.parts.find((p) => p.label === "Barkley")?.count).toBe(4);
    expect(strake.topSpeakers.parts.find((p) => p.label === "Barkley")?.count).toBe(2);
    expect(honorHint(strake.championships)).toContain("4 Barkley");
    const durham = highSchoolHonors("Durham Academy");
    expect(durham.finalists.parts.find((p) => p.label === "Barkley")?.count).toBe(1);
    expect(honorHint(durham.finalists)).toContain("1 Barkley");
  });

  it("lists the breakdown in tournament order and omits tournaments with none", () => {
    const hint = honorHint(highSchoolHonors("Harvard-Westlake School").championships)!;
    const labels = hint.split(" · ").map((part) => part.split(" ")[1]);
    const order = ["TOC", "NDCA", "Barkley", "Cal", "Glenbrooks"];
    expect(labels.map((l) => order.indexOf(l))).toEqual([...labels.map((l) => order.indexOf(l))].sort((x, y) => x - y));
    expect(labels).toContain("Barkley");
    expect(highSchoolHonors("Greenhill").championships.parts.map((p) => p.label)).toContain("Barkley");
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

describe("collegeChampionshipsSince", () => {
  it("counts only NDT, CEDA and Shirley titles from the given season on", () => {
    const ndt = schools.find((s) => s.school === "Northwestern University (IL)")!;
    const all = collegeHonors("Northwestern University", ndt).championships;
    const since = collegeChampionshipsSince("Northwestern University", ndt, 2017);
    expect(since.parts.map((p) => p.label)).toEqual(["NDT", "CEDA", "Shirley"]);
    expect(since.parts[0].count).toBe(ndt.championships.filter((c) => c.year >= 2017).length);
    expect(since.total).toBeLessThanOrEqual(all.total);
    expect(collegeChampionshipsSince("Northwestern University", ndt, -Infinity).total).toBe(all.total);
    expect(collegeChampionshipsSince("Northwestern University", ndt, 3000).total).toBe(0);
  });
});
