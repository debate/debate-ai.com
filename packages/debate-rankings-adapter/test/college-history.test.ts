import { describe, expect, it } from "vitest";
import {
  collegeHistorySourceUrl,
  collegeSeasonDetails,
  collegeWinProbability,
  hasCollegeHistory,
  loadCollegeHistory,
  parseCollegeHistory,
} from "../src/index";

describe("college policy history", () => {
  it("covers the 2009-10 through 2025-26 seasons", () => {
    expect(hasCollegeHistory(2010)).toBe(true);
    expect(hasCollegeHistory("2026")).toBe(true);
    expect(hasCollegeHistory(2009)).toBe(false);
    expect(hasCollegeHistory(2027)).toBe(false);
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
    for (let year = 2010; year <= 2026; year++) {
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
    expect((await loadCollegeHistory(2026))[0]).toMatchObject({
      school: "Emory University",
      name: "Gallagher & Song",
      rating: 42.95,
      mu: 47.17,
      sigma: 1.26,
    });
    expect(await loadCollegeHistory(2027)).toEqual([]);
  });

  it("links each season to the page it came from", () => {
    expect(collegeHistorySourceUrl(2025)).toBe("https://debatedata.weebly.com/2024-25.html");
    expect(collegeHistorySourceUrl("2015")).toBe("https://debatedata.weebly.com/2014-151.html");
    expect(collegeHistorySourceUrl(2026)).toBe("https://debatedata.weebly.com/");
  });

  it("keeps the 2025-26 tournaments and season stats", () => {
    const details = collegeSeasonDetails(2026)!;
    expect(details.tournaments).toHaveLength(27);
    expect(details.stats.map((s) => s.division)).toEqual(["All divisions", "Open", "Junior Varsity", "Novice"]);
    expect(details.stats[1]).toMatchObject({ teams: 366, rounds: 3972, elimAffWinPct: 43.4, pointsIqr: [28.7, 29.2] });
    expect(collegeSeasonDetails(2025)).toBeNull();
  });
});

describe("collegeWinProbability", () => {
  it("is even for identical teams and sums to one across sides", () => {
    const team = { mu: 30, sigma: 1.3 };
    expect(collegeWinProbability(team, team)).toBeCloseTo(0.5, 6);
    const a = { mu: 47.17, sigma: 1.26 };
    const b = { mu: 45.76, sigma: 1.26 };
    expect(collegeWinProbability(a, b) + collegeWinProbability(b, a)).toBeCloseTo(1, 6);
  });

  it("matches debatedata's calculator", () => {
    // Phi(1.41 / sqrt(2 * 1.26^2 + 2 * (25/6)^2)) for the 2025-26 #1 vs #2.
    expect(collegeWinProbability({ mu: 47.17, sigma: 1.26 }, { mu: 45.76, sigma: 1.26 })).toBeCloseTo(0.5906, 3);
    expect(collegeWinProbability({ mu: 23.21, sigma: 1.47 }, { mu: 47.17, sigma: 1.26 })).toBeLessThan(0.0001);
  });
});
