import { describe, expect, it } from "vitest";
import type { RankingEntry } from "@debate/rankings-adapter";
import { AUTO_DIVISIONS, SEASON_TOURNAMENTS, TOP_TEAMS_PER_DIVISION, topEntries, tournamentOutcomes } from "../auto-markets";

const entry = (rank: number): RankingEntry => ({ rank, name: `Team ${rank}`, school: `School ${rank}`, hash: `h${rank}` }) as RankingEntry;

describe("auto markets", () => {
  it("takes the best-ranked entries first", () => {
    const entries = [entry(3), entry(1), entry(2), entry(5), entry(4), entry(6)];
    expect(topEntries(entries, TOP_TEAMS_PER_DIVISION).map((e) => e.rank)).toEqual([1, 2, 3, 4, 5]);
  });

  it("adds a catch-all outcome to a tournament field", () => {
    const outcomes = tournamentOutcomes([entry(1), entry(2)]);
    expect(outcomes.map((o) => o.label)).toEqual(["Team 1 (School 1)", "Team 2 (School 2)", "Someone else"]);
  });

  it("only lists divisions that get markets", () => {
    for (const tournament of SEASON_TOURNAMENTS) {
      for (const division of tournament.divisions) expect(AUTO_DIVISIONS).toContain(division);
    }
  });
});
