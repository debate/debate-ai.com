import { describe, expect, it } from "vitest";
import {
  findPastHighSchoolTeam,
  pastHighSchoolSchoolKeys,
  pastHighSchoolTeamHandle,
} from "../src/leaderboard/profile/pastHighSchoolTeam";
import { teamHandle } from "../src/leaderboard/profile/rankingProfileHelpers";

const seasons = [
  {
    year: 2019,
    event: "Policy" as const,
    teams: [
      { rank: 4, fieldSize: 900, name: "Smith & Jones", bids: 3 },
      { rank: 20, fieldSize: 900, name: "Lee & Park", bids: 1 },
    ],
  },
  { year: 2021, event: "Policy" as const, teams: [{ rank: 2, fieldSize: 800, name: "Smith & Jones", bids: 5 }] },
  { year: 2021, event: "Lincoln-Douglas" as const, teams: [{ rank: 9, fieldSize: 1200, name: "Ann Wu", bids: 2 }] },
];

describe("past high school teams", () => {
  it("links with the same handle a ranked team gets", () => {
    const school = "St. Mark's School of Texas";
    expect(pastHighSchoolTeamHandle("st-mark-s-school-of-texas", "Smith & Jones")).toBe(
      teamHandle({ school, name: "Smith & Jones" }),
    );
  });

  it("guesses the school key by dropping name words, pair first", () => {
    expect(pastHighSchoolSchoolKeys("st-mark-s-school-of-texas-smith-jones")).toEqual([
      "st-mark-s-school-of-texas",
      "st-mark-s-school-of-texas-smith",
      "st-mark-s-school-of",
      "st-mark-s-school",
    ]);
    expect(pastHighSchoolSchoolKeys("harker")).toEqual([]);
  });

  it("collects every season the team was listed, newest first", () => {
    const team = findPastHighSchoolTeam(seasons, "st-mark-s-school-of-texas", "st-mark-s-school-of-texas-smith-jones");
    expect(team?.name).toBe("Smith & Jones");
    expect(team?.seasons.map((s) => [s.year, s.rank, s.bids])).toEqual([
      [2021, 2, 5],
      [2019, 4, 3],
    ]);
    expect(findPastHighSchoolTeam(seasons, "st-mark-s-school-of-texas", "st-mark-s-school-of-texas-wu")?.seasons).toHaveLength(1);
    expect(findPastHighSchoolTeam(seasons, "st-mark-s-school-of-texas", "st-mark-s-school-of-texas-nobody")).toBeNull();
  });
});
