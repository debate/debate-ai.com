import { describe, expect, it } from "vitest";
import { findHsProgramRecord, hsProgramRecords, otherNationalsResults } from "../src/sync/hs-program-records";
import { tocRecordsBySchool, tocSchoolMatcher } from "../src/sync/toc-champions";
import { HS_STRENGTH_WEIGHTS, schoolSeasonScores, schoolStrengthTable } from "../src/school-seasons";

describe("high school program-strength records", () => {
  it("adds NDCA, Cal and Glenbrooks finishes to a school's TOC record", () => {
    const greenhill = findHsProgramRecord("Greenhill School (TX)")!;
    const tournaments = new Set(greenhill.results.map((r) => r.tournament));
    expect(tournaments).toEqual(new Set(["TOC", "NDCA", "Glenbrooks"]));
    // Counts stay the TOC's own.
    expect(greenhill.titles).toBe(tocSchoolMatcher()("Greenhill School (TX)")!.titles);
  });

  it("files a November Glenbrooks under the next year's season and scores a finalist as a runner-up", () => {
    const rows = otherNationalsResults([], [], [
      { year: 2008, event: "Policy", place: "Finalist", school: "St. Mark's School of Texas (TX)", competitors: "Alex Gulakov & Alex Miles" },
      { year: 2008, event: "Policy", place: "Champion", school: "Imaginary Prep (ZZ)", competitors: "A B & C D" },
    ]);
    expect(rows.map((r) => [r.year, r.place])).toEqual([
      [2009, "Runner-up"],
      [2009, "Champion"],
    ]);
    const records = hsProgramRecords(undefined, rows);
    const imaginary = records.find((r) => r.school === "Imaginary Prep (ZZ)")!;
    expect(imaginary.titles).toBe(0);
    const series = schoolSeasonScores([], imaginary, 2009, 2009);
    expect(series[0].parts.nationals).toBe(HS_STRENGTH_WEIGHTS.toc.Champion);
    expect(series[0].parts.toc).toBe(0);
  });

  it("drops quarterfinals and lower speaker places, as the TOC does", () => {
    const rows = otherNationalsResults(
      [
        { year: 2009, place: "Quarterfinalist", school: "Glenbrook North High School (IL)", competitors: "Flynn Makuch & Victor Shao" },
        { year: 2009, place: "Speaker", rank: 3, school: "Glenbrook North High School (IL)", competitors: "Flynn Makuch" },
      ],
      [],
      [],
    );
    expect(rows).toEqual([]);
  });

  it("keeps every TOC school matchable by its own name", () => {
    const records = hsProgramRecords();
    const match = tocSchoolMatcher(records);
    const tocMatch = tocSchoolMatcher(tocRecordsBySchool());
    for (const record of tocRecordsBySchool()) {
      if (!tocMatch(record.school)) continue;
      expect(match(record.school)?.school, record.school).toBe(record.school);
    }
  });

  it("scores NDCA, Cal and Glenbrooks in the program strength table", () => {
    const rows = [{ school: "greenhill", year: 2019, points: 1, event: "Policy" as const }];
    const withNationals = schoolStrengthTable(rows, undefined, "Policy").get("greenhill")!.get(2019)!;
    const tocOnly = schoolStrengthTable(rows, tocRecordsBySchool(), "Policy").get("greenhill")!.get(2019)!;
    // The 2018 Glenbrooks title (2018-19 season) adds a champion's points.
    expect(withNationals - tocOnly).toBe(HS_STRENGTH_WEIGHTS.toc.Champion);
  });

  it("ranks programs with no ranked entry alongside ranked ones by default", () => {
    const table = schoolStrengthTable([{ school: "greenhill", year: 2019, points: 1, event: "Policy" as const }], undefined, "Policy");
    const tocOnly = [...table.keys()].filter((key) => key.startsWith("toc:"));
    expect(tocOnly.length).toBeGreaterThan(50);
    expect(tocOnly).toContain(`toc:${findHsProgramRecord("Montgomery Bell Academy")!.school}`);
    expect(tocOnly.some((key) => key.toLowerCase().includes("greenhill"))).toBe(false);
  });
});
