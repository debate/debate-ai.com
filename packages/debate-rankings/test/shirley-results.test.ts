import { describe, expect, it } from "vitest";
import {
  SHIRLEY_NO_RESULT,
  SHIRLEY_RESULTS,
  findShirleySchoolResults,
  shirleyResultsBySchool,
  shirleySeasonYear,
} from "../src/sync/shirley-results";

describe("Shirley Classic results", () => {
  it("covers 1956–2026 except 1994, with no invented years", () => {
    const years = new Set(SHIRLEY_RESULTS.map((r) => r.year));
    for (let year = 1956; year <= 2026; year++) {
      expect(years.has(year), String(year)).toBe(!(year in SHIRLEY_NO_RESULT));
    }
    expect(Object.keys(SHIRLEY_NO_RESULT)).toEqual(["1994"]);
  });

  it("fills the archive's gaps from the brackets", () => {
    const final = (year: number) => SHIRLEY_RESULTS.filter((r) => r.year === year).map((r) => [r.place, r.school, r.team]);
    expect(final(2007)).toEqual([
      ["Champion", "Harvard University", "Anders & Murray"],
      ["Second place", "Dartmouth College", "Kernoff & Olsen"],
    ]);
    expect(final(2026)).toEqual([
      ["Champion", "Emory University", "Gallagher & Young"],
      ["Second place", "University of Michigan", "Barrett & Song"],
    ]);
    expect(findShirleySchoolResults("SUNY Binghamton")?.championships).toBe(1);
  });

  it("puts November finals in the next season and the February editions in their own", () => {
    expect(shirleySeasonYear({ year: 2024 })).toBe(2025);
    const feb = SHIRLEY_RESULTS.filter((r) => r.february).map((r) => [r.year, r.note ?? ""]);
    expect(feb).toEqual([
      [1995, ""],
      [1995, ""],
      [1996, "Michigan-hosted edition"],
      [1996, "Michigan-hosted edition"],
    ]);
  });

  it("has one champion and one runner-up per final, keeping 1996's two editions and 2011's co-champions", () => {
    const byYear = new Map<number, string[]>();
    for (const r of SHIRLEY_RESULTS) byYear.set(r.year, [...(byYear.get(r.year) ?? []), r.place]);
    expect(byYear.get(1996)).toEqual(["Champion", "Second place", "Champion", "Second place"]);
    expect(byYear.get(2011)).toEqual(["Champion", "Champion"]);
    for (const [year, places] of byYear) {
      if (year === 1996 || year === 2011) continue;
      expect(places, String(year)).toEqual(["Champion", "Second place"]);
    }
  });

  it("matches schools as the rankings spell them without crossing similar names", () => {
    expect(findShirleySchoolResults("Northwestern")?.championships).toBe(16);
    expect(findShirleySchoolResults("Michigan")?.championships).toBe(5);
    expect(findShirleySchoolResults("Michigan State")?.school).toBe("Michigan State University");
    expect(findShirleySchoolResults("Michigan State")?.championships).toBe(0);
    expect(findShirleySchoolResults("Wake Forest University (NC)")?.secondPlaces).toBe(3);
    expect(findShirleySchoolResults("UC Berkeley")?.championships).toBe(3);
    expect(findShirleySchoolResults("William and Mary")?.school).toBe("College of William & Mary");
    expect(findShirleySchoolResults("West Georgia")?.championships).toBe(2);
    expect(findShirleySchoolResults("Kansas State")).toBeNull();
    expect(findShirleySchoolResults("University of Northwestern")).toBeNull();
    expect(findShirleySchoolResults("Georgetown College")).toBeNull();
  });

  it("counts every final once across schools", () => {
    const schools = shirleyResultsBySchool();
    const total = schools.reduce((n, s) => n + s.championships + s.secondPlaces, 0);
    expect(total).toBe(SHIRLEY_RESULTS.length);
  });
});
