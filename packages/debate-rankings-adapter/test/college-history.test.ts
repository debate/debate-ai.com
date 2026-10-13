import { describe, expect, it } from "vitest";
import { hasCollegeHistory, loadCollegeHistory, parseCollegeHistory } from "../src/index";

describe("college policy history", () => {
  it("covers the 2009-10 through 2024-25 seasons", () => {
    expect(hasCollegeHistory(2010)).toBe(true);
    expect(hasCollegeHistory("2025")).toBe(true);
    expect(hasCollegeHistory(2009)).toBe(false);
    expect(hasCollegeHistory(2026)).toBe(false);
  });

  it("parses quoted school names and orders each season by rank", () => {
    const csv = [
      "Season,Rank,School,Team,Rating,Mu,Sigma",
      '2009-10,2,"University of California, Berkeley",Bowen & Polin,47.05,50.73,1.23',
      "2009-10,1,Northwestern University,Fisher & Spies,52.56,56.14,1.19",
    ].join("\n");
    const season = parseCollegeHistory(csv).get("2009-10")!;
    expect(season.map((e) => e.rank)).toEqual([1, 2]);
    expect(season[1]).toEqual({
      rank: 2,
      school: "University of California, Berkeley",
      name: "Bowen & Polin",
      rating: 47.05,
      mu: 50.73,
      sigma: 1.23,
    });
  });

  it("loads 100 ranked teams for every covered season", async () => {
    for (let year = 2010; year <= 2025; year++) {
      const entries = await loadCollegeHistory(year);
      expect(entries).toHaveLength(100);
      expect(entries.map((e) => e.rank)).toEqual(Array.from({ length: 100 }, (_, i) => i + 1));
      for (let i = 1; i < entries.length; i++) {
        expect(entries[i].rating).toBeLessThanOrEqual(entries[i - 1].rating);
      }
    }
    expect((await loadCollegeHistory(2025))[0]).toMatchObject({
      school: "University of Kansas",
      name: "Marshall & Revare",
    });
    expect(await loadCollegeHistory(2026)).toEqual([]);
  });
});
