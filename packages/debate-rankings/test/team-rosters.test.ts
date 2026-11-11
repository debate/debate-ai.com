import { describe, expect, it } from "vitest";
import { extinctionEntries, type CombinedDebateData } from "../src/extinction";
import { teamDisplayParts } from "../src/team-display";
import { findTeamRanking } from "../src/team-lookup";
import { findTeamRoster } from "../src/team-rosters";
import type { RankingEntry } from "../src/types";

describe("Iowa AP roster", () => {
  it("finds the roster by school and code, in either order", () => {
    expect(findTeamRoster({ school: "Iowa", code: "AP" })?.debaters).toEqual([
      "Spencer Anderson McElligott",
      "Grey Parfenoff",
    ]);
    expect(findTeamRoster({ school: "University of Iowa", code: "PA" })).not.toBeNull();
    expect(findTeamRoster({ school: "Iowa State", code: "AP" })).toBeNull();
    expect(findTeamRoster({ school: "Iowa", code: "KP" })).toBeNull();
  });

  it("finds the roster by the debaters' names", () => {
    expect(findTeamRoster({ school: "University of Iowa", name: "Grey Parfenoff & Spencer Anderson McElligott" })).not.toBeNull();
    expect(findTeamRoster({ school: "Iowa", name: "Kleiman & Parfenoff" })).toBeNull();
  });

  it("labels the team with both surnames, the two-word one whole", () => {
    expect(teamDisplayParts({ label: "Iowa AP" })).toEqual({
      school: "Iowa",
      debaters: "Anderson McElligott & Parfenoff",
    });
    expect(
      teamDisplayParts({ school: "University of Iowa", name: "Spencer Anderson McElligott & Grey Parfenoff" }),
    ).toEqual({ school: "University of Iowa", debaters: "Anderson McElligott & Parfenoff" });
    // Other Iowa teams are untouched.
    expect(teamDisplayParts({ label: "Iowa KP", school: "Iowa", name: "Kleiman & Parfenoff" }).debaters).toBe(
      "Kleiman & Parfenoff",
    );
  });

  it("overrides Extinction.GG's names for the team and still matches the video label", () => {
    const data = {
      format: "collegepolicy",
      season: "25-26",
      generated: "",
      tournaments: [],
      pending: [],
      teams: [
        {
          SchoolTeamCode: "Iowa AP: McElligott & Parfenoff",
          FullName1: "Spencer McElligott",
          FullName2: "Grey Parfenoff",
          OverallELO: 2000,
          tocBidTournamentCodes: [],
        },
      ],
    } as unknown as CombinedDebateData;
    const [entry] = extinctionEntries(data);
    expect(entry.name).toBe("Anderson McElligott & Parfenoff");
    expect(entry.debaters).toEqual(["Spencer Anderson McElligott", "Grey Parfenoff"]);
    expect(findTeamRanking([entry as RankingEntry], "Iowa AP")).toBe(entry);
  });
});
