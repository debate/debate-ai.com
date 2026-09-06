import { describe, expect, it } from "vitest";
import {
  DEFAULT_QUEST_TEAMS_SYNC,
  isValidQuestTeamsList,
  MAX_QUEST_TEAM_CONTRIBUTOR_IDS,
  MAX_QUEST_TEAMS,
  normalizeQuestTeamsPatch,
  parseQuestTeams,
  serializeQuestTeams,
} from "../src/lib/quest-teams-sync";
import type { QuestTeam } from "../src/lib/daily-quests";

const TEAM_A: QuestTeam = { id: "team-1", name: "Team Alpha", contributorIds: ["alex", "jordan"] };
const TEAM_B: QuestTeam = { id: "team-2", name: "Team Beta", contributorIds: ["sam"] };

describe("DEFAULT_QUEST_TEAMS_SYNC", () => {
  it("defaults to an empty roster", () => {
    expect(DEFAULT_QUEST_TEAMS_SYNC).toEqual({ questTeams: [] });
  });
});

describe("isValidQuestTeamsList", () => {
  it("accepts an empty list", () => {
    expect(isValidQuestTeamsList([])).toBe(true);
  });

  it("accepts a well-formed list of teams", () => {
    expect(isValidQuestTeamsList([TEAM_A, TEAM_B])).toBe(true);
  });

  it("accepts a team with no members", () => {
    expect(isValidQuestTeamsList([{ id: "team-1", name: "Empty Team", contributorIds: [] }])).toBe(true);
  });

  it("accepts exactly the maximum number of teams", () => {
    const teams = Array.from({ length: MAX_QUEST_TEAMS }, (_, i) => ({
      id: `team-${i}`,
      name: `Team ${i}`,
      contributorIds: ["alex"],
    }));
    expect(isValidQuestTeamsList(teams)).toBe(true);
  });

  it("rejects more than the maximum number of teams", () => {
    const teams = Array.from({ length: MAX_QUEST_TEAMS + 1 }, (_, i) => ({
      id: `team-${i}`,
      name: `Team ${i}`,
      contributorIds: ["alex"],
    }));
    expect(isValidQuestTeamsList(teams)).toBe(false);
  });

  it("rejects exactly the maximum plus one contributor ids on one team", () => {
    const contributorIds = Array.from({ length: MAX_QUEST_TEAM_CONTRIBUTOR_IDS + 1 }, (_, i) => `contributor-${i}`);
    expect(isValidQuestTeamsList([{ id: "team-1", name: "Team", contributorIds }])).toBe(false);
  });

  it("accepts exactly the maximum number of contributor ids on one team", () => {
    const contributorIds = Array.from({ length: MAX_QUEST_TEAM_CONTRIBUTOR_IDS }, (_, i) => `contributor-${i}`);
    expect(isValidQuestTeamsList([{ id: "team-1", name: "Team", contributorIds }])).toBe(true);
  });

  it("rejects two teams sharing an id", () => {
    expect(isValidQuestTeamsList([TEAM_A, { ...TEAM_B, id: TEAM_A.id }])).toBe(false);
  });

  it("rejects a team with an empty name", () => {
    expect(isValidQuestTeamsList([{ id: "team-1", name: "", contributorIds: ["alex"] }])).toBe(false);
  });

  it("rejects a team with a blank id", () => {
    expect(isValidQuestTeamsList([{ id: "  ", name: "Team", contributorIds: ["alex"] }])).toBe(false);
  });

  it("rejects a team with a non-string contributor id", () => {
    expect(isValidQuestTeamsList([{ id: "team-1", name: "Team", contributorIds: [42] }])).toBe(false);
  });

  it("rejects a team with a blank contributor id", () => {
    expect(isValidQuestTeamsList([{ id: "team-1", name: "Team", contributorIds: ["  "] }])).toBe(false);
  });

  it("rejects an unrecognized field, e.g. a smuggled ownerId", () => {
    expect(isValidQuestTeamsList([{ ...TEAM_A, ownerId: "someone-else" }])).toBe(false);
  });

  it("rejects non-array values", () => {
    expect(isValidQuestTeamsList(null)).toBe(false);
    expect(isValidQuestTeamsList("teams")).toBe(false);
    expect(isValidQuestTeamsList(TEAM_A)).toBe(false);
  });
});

describe("normalizeQuestTeamsPatch", () => {
  it("accepts an empty roster", () => {
    const result = normalizeQuestTeamsPatch({ questTeams: [] });
    expect(result.errors).toEqual([]);
    expect(result.valid).toEqual({ questTeams: [] });
  });

  it("accepts a well-formed roster", () => {
    const result = normalizeQuestTeamsPatch({ questTeams: [TEAM_A, TEAM_B] });
    expect(result.errors).toEqual([]);
    expect(result.valid).toEqual({ questTeams: [TEAM_A, TEAM_B] });
  });

  it("rejects a malformed roster with an error message and leaves valid empty", () => {
    const result = normalizeQuestTeamsPatch({ questTeams: [{ id: "team-1" }] });
    expect(result.errors).toHaveLength(1);
    expect(result.valid).toEqual({});
  });

  it("omits the field entirely when absent from the input", () => {
    const result = normalizeQuestTeamsPatch({ debateStyle: 1 });
    expect(result.errors).toEqual([]);
    expect(result.valid).toEqual({});
  });

  it("rejects a non-object request body", () => {
    const result = normalizeQuestTeamsPatch("not an object");
    expect(result.errors).toHaveLength(1);
    expect(result.valid).toEqual({});
  });
});

describe("serializeQuestTeams / parseQuestTeams", () => {
  it("round-trips a roster", () => {
    const teams = [TEAM_A, TEAM_B];
    expect(parseQuestTeams(serializeQuestTeams(teams))).toEqual(teams);
  });

  it("serializes an empty list to null and parses null/empty back to an empty list", () => {
    expect(serializeQuestTeams([])).toBeNull();
    expect(parseQuestTeams(null)).toEqual([]);
    expect(parseQuestTeams(undefined)).toEqual([]);
    expect(parseQuestTeams("")).toEqual([]);
  });

  it("parses corrupt JSON back to an empty list rather than throwing", () => {
    expect(parseQuestTeams("{not json")).toEqual([]);
  });

  it("parses a stored value that fails validation back to an empty list", () => {
    expect(parseQuestTeams(JSON.stringify([{ id: "team-1" }]))).toEqual([]);
  });
});
