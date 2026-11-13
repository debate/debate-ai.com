import { describe, expect, it } from "vitest";
import type { NdtSchoolHistory } from "../src/sync/ndt-school-history";
import { buildNdtAllSeasons, rowRanks } from "../src/leaderboard/profile/ndtAllSeasons";
import { loadNdtAllTimeRanks, ndtAllTimeRankLookup } from "../src/leaderboard/profile/ndtAllTimeRanks";
import history from "../data/ndt-school-history.json";

const ndt = history as NdtSchoolHistory[];
const lookup = ndtAllTimeRankLookup(ndt);
const table = buildNdtAllSeasons(ndt);

describe("ndtAllTimeRankLookup", () => {
  it("ranks Northwestern MV's pair and each debater on the all-seasons table", () => {
    const ranks = lookup("Northwestern MV", 2015);
    expect(ranks?.school).toBe("Northwestern University (IL)");
    expect(ranks?.team?.name).toBe("Alex Miles & Arjun Vellayappan");
    expect(ranks?.team?.mode).toBe("teams");
    const teamIndex = table.teams.findIndex((row) => row.team === "Alex Miles & Arjun Vellayappan");
    expect(ranks?.team?.rank).toBe(rowRanks(table.teams)[teamIndex]);
    expect(ranks?.team?.of).toBe(table.teams.length);
    const vellayappan = ranks?.debaters.find((d) => d.name === "Arjun Vellayappan");
    expect(vellayappan?.rank).toBe(1);
    expect(ranks?.debaters.map((d) => d.name).sort()).toEqual(["Alex Miles", "Arjun Vellayappan"]);
  });

  it("matches initials in either speaking order", () => {
    expect(lookup("Northwestern VM", 2015)?.team?.name).toBe("Alex Miles & Arjun Vellayappan");
  });

  it("falls back to the strictly-together rank for a pair that was neither debater's best", () => {
    const ranks = lookup("Northwestern LV", 2013);
    expect(ranks?.team?.name).toBe("Peyton Lee & Arjun Vellayappan");
    expect(ranks?.team?.mode).toBe("strict");
    expect(ranks?.team?.of).toBe(table.strictTeams.length);
  });

  it("picks the pair debating nearest the round's year and ignores far-off namesakes", () => {
    const sample: NdtSchoolHistory[] = [
      {
        school: "Example University (XX)",
        years: [],
        elims: [
          { year: 1980, team: "Ann Able & Bob Baker", round: "Champion" },
          { year: 2010, team: "Amy Adams & Ben Brown", round: "Octas" },
        ],
        championships: [],
        atLargeBids: [],
        copelandWinners: [],
        speakerAwards: [],
        coachingAwards: [],
      },
    ];
    const local = ndtAllTimeRankLookup(sample);
    expect(local("Example AB", 2009)?.team?.name).toBe("Amy Adams & Ben Brown");
    expect(local("Example AB", 1979)?.team?.name).toBe("Ann Able & Bob Baker");
    expect(local("Example AB", 1995)).toBeNull();
  });

  it("returns null for labels with no NDT partnership", () => {
    expect(lookup("Harker LL", 2025)).toBeNull();
    expect(lookup("Boston College", 2026)).toBeNull();
    expect(lookup(null)).toBeNull();
  });

  it("loads the bundled history once", async () => {
    const first = await loadNdtAllTimeRanks();
    expect(first("Georgetown AM", 2013)?.team?.rank).toBe(1);
    expect(await loadNdtAllTimeRanks()).toBe(first);
  });
});
