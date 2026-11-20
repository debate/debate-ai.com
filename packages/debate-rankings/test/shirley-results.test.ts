import { describe, expect, it } from "vitest";
import {
  SHIRLEY_NO_RESULT,
  SHIRLEY_RESULTS,
  findShirleySchoolResults,
  shirleyResultsBySchool,
} from "../src/sync/shirley-results";

describe("Shirley Classic results", () => {
  it("covers 1956–2022 except the archive's gaps, with no invented years", () => {
    const years = new Set(SHIRLEY_RESULTS.map((r) => r.year));
    for (let year = 1956; year <= 2022; year++) {
      expect(years.has(year), String(year)).toBe(!(year in SHIRLEY_NO_RESULT));
    }
    for (const gap of [1994, 2007, 2008, 2023, 2024, 2025, 2026]) {
      expect(SHIRLEY_NO_RESULT[gap]).toBeTruthy();
      expect(years.has(gap)).toBe(false);
    }
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
    expect(findShirleySchoolResults("Northwestern")?.championships).toBe(15);
    expect(findShirleySchoolResults("Michigan")?.championships).toBe(5);
    expect(findShirleySchoolResults("Michigan State")?.school).toBe("Michigan State University");
    expect(findShirleySchoolResults("Michigan State")?.championships).toBe(0);
    expect(findShirleySchoolResults("Wake Forest University (NC)")?.secondPlaces).toBe(2);
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
