import { describe, expect, it } from "vitest";
import {
  DEFAULT_QUALIFICATION_POINTS_TABLE,
  buildStandings,
  buildTeamStanding,
  compareFinishes,
  computeTournamentPoints,
  getFinishRank,
  getQualifiedTeams,
  rankStandings,
  type TournamentResult,
} from "../src/rankings/ndca-standings";

describe("getFinishRank / compareFinishes", () => {
  it("ranks champion above every other finish", () => {
    expect(getFinishRank("champion")).toBeGreaterThan(getFinishRank("finalist"));
    expect(getFinishRank("finalist")).toBeGreaterThan(getFinishRank("semifinalist"));
  });

  it("ranks prelims as the lowest finish", () => {
    expect(getFinishRank("prelims")).toBe(1);
  });

  it("compares two finishes by rank difference", () => {
    expect(compareFinishes("champion", "prelims")).toBeGreaterThan(0);
    expect(compareFinishes("prelims", "champion")).toBeLessThan(0);
    expect(compareFinishes("finalist", "finalist")).toBe(0);
  });
});

describe("computeTournamentPoints", () => {
  it("sums outround points and prelim-win points at a no-bid tournament", () => {
    expect(
      computeTournamentPoints({ finish: "prelims", prelimWins: 3, bidLevel: 0 }),
    ).toBe(3);
  });

  it("scales points up by the bid-level bonus", () => {
    expect(
      computeTournamentPoints({ finish: "champion", prelimWins: 5, bidLevel: 0 }),
    ).toBe(35);
    expect(
      computeTournamentPoints({ finish: "champion", prelimWins: 5, bidLevel: 2 }),
    ).toBe(42);
  });

  it("clamps negative prelim wins and negative bid levels to zero", () => {
    expect(
      computeTournamentPoints({ finish: "prelims", prelimWins: -4, bidLevel: 0 }),
    ).toBe(0);
    expect(
      computeTournamentPoints({ finish: "champion", prelimWins: 0, bidLevel: -3 }),
    ).toBe(DEFAULT_QUALIFICATION_POINTS_TABLE.outroundPoints.champion);
  });

  it("honors a custom points table", () => {
    const flatTable = {
      outroundPoints: {
        champion: 10,
        finalist: 8,
        semifinalist: 6,
        quarterfinalist: 4,
        octofinalist: 2,
        doubleOctofinalist: 1,
        tripleOctofinalist: 0,
        prelims: 0,
      },
      pointsPerPrelimWin: 0,
      bidLevelBonusRate: 0,
    };
    expect(
      computeTournamentPoints(
        { finish: "finalist", prelimWins: 100, bidLevel: 5 },
        flatTable,
      ),
    ).toBe(8);
  });
});

function result(overrides: Partial<TournamentResult> = {}): TournamentResult {
  return {
    teamId: "A",
    tournamentName: "T",
    date: "2026-01-01",
    division: "PF",
    bidLevel: 0,
    finish: "prelims",
    prelimWins: 0,
    prelimLosses: 0,
    ...overrides,
  };
}

describe("buildTeamStanding", () => {
  const quarters = result({
    tournamentName: "Quarters Bid",
    bidLevel: 1,
    finish: "quarterfinalist",
    prelimWins: 5,
    prelimLosses: 1,
  });
  const octos = result({
    tournamentName: "Octos Bid",
    bidLevel: 0,
    finish: "octofinalist",
    prelimWins: 4,
    prelimLosses: 2,
  });

  it("sums points across every attended tournament by default", () => {
    const standing = buildTeamStanding("A", [quarters, octos]);
    expect(standing.totalPoints).toBe(39.1);
    expect(standing.tournamentsAttended).toBe(2);
    expect(standing.tournamentsCounted).toBe(2);
  });

  it("aggregates the prelim record across all attended tournaments", () => {
    const standing = buildTeamStanding("A", [quarters, octos]);
    expect(standing.record).toEqual({ wins: 9, losses: 3 });
  });

  it("reports the best finish across all attended tournaments", () => {
    const standing = buildTeamStanding("A", [quarters, octos]);
    expect(standing.bestFinish).toBe("quarterfinalist");
  });

  it("counts only the best N tournaments toward total points when capped", () => {
    const standing = buildTeamStanding("A", [quarters, octos], { countBestN: 1 });
    expect(standing.tournamentsCounted).toBe(1);
    expect(standing.totalPoints).toBe(23.1);
    // record and best finish still reflect every tournament attended, not just counted ones
    expect(standing.tournamentsAttended).toBe(2);
    expect(standing.record).toEqual({ wins: 9, losses: 3 });
  });

  it("returns a zeroed standing for a team with no results", () => {
    const standing = buildTeamStanding("EMPTY", []);
    expect(standing.totalPoints).toBe(0);
    expect(standing.tournamentsAttended).toBe(0);
    expect(standing.record).toEqual({ wins: 0, losses: 0 });
    expect(standing.bestFinish).toBe("prelims");
  });
});

describe("buildStandings", () => {
  it("builds one standing per team keyed in the input", () => {
    const standings = buildStandings({
      A: [result({ teamId: "A", finish: "champion", bidLevel: 0 })],
      B: [result({ teamId: "B", finish: "finalist", bidLevel: 0 })],
    });
    expect(standings.map((s) => s.teamId).sort()).toEqual(["A", "B"]);
  });
});

describe("rankStandings", () => {
  it("ranks by total points, descending", () => {
    const standings = buildStandings({
      low: [result({ teamId: "low", finish: "octofinalist" })],
      high: [result({ teamId: "high", finish: "champion" })],
    });
    const ranked = rankStandings(standings);
    expect(ranked.map((s) => s.teamId)).toEqual(["high", "low"]);
    expect(ranked[0].rank).toBe(1);
    expect(ranked[1].rank).toBe(2);
  });

  it("breaks ties by team id for a stable, deterministic order", () => {
    const standings = buildStandings({
      zeta: [result({ teamId: "zeta", finish: "finalist" })],
      alpha: [result({ teamId: "alpha", finish: "finalist" })],
    });
    const ranked = rankStandings(standings);
    expect(ranked.map((s) => s.teamId)).toEqual(["alpha", "zeta"]);
  });

  it("returns an empty ranking for an empty standings list", () => {
    expect(rankStandings([])).toEqual([]);
  });
});

describe("getQualifiedTeams", () => {
  const ranked = rankStandings(
    buildStandings({
      champ: [result({ teamId: "champ", finish: "champion" })],
      finalist: [result({ teamId: "finalist", finish: "finalist" })],
      early: [result({ teamId: "early", finish: "prelims" })],
    }),
  );

  it("filters out teams below the minimum points threshold", () => {
    const qualified = getQualifiedTeams(ranked, { minPoints: 25 });
    expect(qualified.map((s) => s.teamId)).toEqual(["champ", "finalist"]);
  });

  it("caps the field to the top N qualifiers", () => {
    const qualified = getQualifiedTeams(ranked, { maxQualifiers: 1 });
    expect(qualified.map((s) => s.teamId)).toEqual(["champ"]);
  });

  it("returns every standing when no options are given", () => {
    expect(getQualifiedTeams(ranked)).toHaveLength(3);
  });
});
