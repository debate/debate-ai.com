import { describe, expect, it } from "vitest";
import {
  buildOpponentScoutingReportText,
  buildOpponentScoutingSummary,
  buildOpponentTeamComparison,
  buildOpponentTeamComparisonText,
  buildOpponentTeamProfile,
  buildOpponentTeamProfiles,
  getHeadToHeadRecords,
  groupRecordsByTeam,
  opponentScoutingReportFilename,
  opponentTeamComparisonFilename,
  type OpponentRoundRecord,
} from "../src/rankings/opponent-team-profile";

function record(overrides: Partial<OpponentRoundRecord> = {}): OpponentRoundRecord {
  return {
    teamId: "wxyz",
    tournamentName: "Berkeley",
    date: "2026-01-01",
    division: "PF",
    side: "aff",
    won: true,
    ...overrides,
  };
}

describe("buildOpponentTeamProfile", () => {
  it("returns a zeroed profile with no crash for a team with no recorded rounds", () => {
    const profile = buildOpponentTeamProfile("empty", []);
    expect(profile.roundsRecorded).toBe(0);
    expect(profile.tournamentsAttended).toBe(0);
    expect(profile.record).toEqual({ wins: 0, losses: 0, winRate: 0 });
    expect(profile.sideRecord.aff).toEqual({ rounds: 0, wins: 0, winRate: 0 });
    expect(profile.sideRecord.neg).toEqual({ rounds: 0, wins: 0, winRate: 0 });
    expect(profile.sideRecord.hasNotableSidePreference).toBe(false);
    expect(profile.sideRecord.strongerSide).toBeNull();
    expect(profile.topArgumentTags).toEqual([]);
    expect(profile.topCases).toEqual([]);
  });

  it("counts wins/losses and unique tournaments across the history", () => {
    const profile = buildOpponentTeamProfile("wxyz", [
      record({ tournamentName: "Berkeley", won: true }),
      record({ tournamentName: "Berkeley", won: false }),
      record({ tournamentName: "Harvard", won: true }),
    ]);
    expect(profile.roundsRecorded).toBe(3);
    expect(profile.tournamentsAttended).toBe(2);
    expect(profile.record).toEqual({ wins: 2, losses: 1, winRate: round2(2 / 3) });
  });

  it("splits the record by side", () => {
    const profile = buildOpponentTeamProfile("wxyz", [
      record({ side: "aff", won: true }),
      record({ side: "aff", won: false }),
      record({ side: "neg", won: true }),
    ]);
    expect(profile.sideRecord.aff).toEqual({ rounds: 2, wins: 1, winRate: 0.5 });
    expect(profile.sideRecord.neg).toEqual({ rounds: 1, wins: 1, winRate: 1 });
  });

  it("flags a notable side preference once there are enough rounds on both sides and a skewed gap", () => {
    const records = [
      ...Array.from({ length: 4 }, () => record({ side: "aff", won: true })),
      record({ side: "neg", won: false }),
    ];
    const profile = buildOpponentTeamProfile("skewed", records);
    expect(profile.roundsRecorded).toBe(5);
    expect(profile.sideRecord.hasNotableSidePreference).toBe(true);
    expect(profile.sideRecord.strongerSide).toBe("aff");
  });

  it("does not flag a side preference below the minimum sample size even if fully one-sided", () => {
    const records = [
      record({ side: "aff", won: true }),
      record({ side: "aff", won: true }),
      record({ side: "neg", won: false }),
    ];
    const profile = buildOpponentTeamProfile("small-sample", records);
    expect(profile.sideRecord.hasNotableSidePreference).toBe(false);
    expect(profile.sideRecord.strongerSide).toBeNull();
  });

  it("does not flag a side preference when win rates are close", () => {
    const records = [
      ...Array.from({ length: 2 }, () => record({ side: "aff", won: true })),
      ...Array.from({ length: 2 }, () => record({ side: "aff", won: false })),
      ...Array.from({ length: 2 }, () => record({ side: "neg", won: true })),
      ...Array.from({ length: 2 }, () => record({ side: "neg", won: false })),
    ];
    const profile = buildOpponentTeamProfile("even", records);
    expect(profile.sideRecord.hasNotableSidePreference).toBe(false);
  });

  it("does not flag a side preference when a team has never played one side", () => {
    const records = Array.from({ length: 6 }, () => record({ side: "aff", won: true }));
    const profile = buildOpponentTeamProfile("aff-only", records);
    expect(profile.sideRecord.neg.rounds).toBe(0);
    expect(profile.sideRecord.hasNotableSidePreference).toBe(false);
    expect(profile.sideRecord.strongerSide).toBeNull();
  });

  it("ranks argument tags by frequency, tie-broken alphabetically", () => {
    const profile = buildOpponentTeamProfile("wxyz", [
      record({ argumentTags: ["kritik", "topicality"] }),
      record({ argumentTags: ["kritik"] }),
      record({ argumentTags: ["counterplan"] }),
    ]);
    expect(profile.topArgumentTags).toEqual([
      { value: "kritik", count: 2 },
      { value: "counterplan", count: 1 },
      { value: "topicality", count: 1 },
    ]);
  });

  it("ranks case names by frequency, ignoring rounds without one", () => {
    const profile = buildOpponentTeamProfile("wxyz", [
      record({ caseName: "Warming Aff" }),
      record({ caseName: "Warming Aff" }),
      record({}),
    ]);
    expect(profile.topCases).toEqual([{ value: "Warming Aff", count: 2 }]);
  });
});

describe("groupRecordsByTeam / buildOpponentTeamProfiles", () => {
  it("groups records by teamId and builds one profile per team", () => {
    const records = [
      record({ teamId: "wxyz" }),
      record({ teamId: "abcd" }),
      record({ teamId: "wxyz" }),
    ];
    const grouped = groupRecordsByTeam(records);
    expect(Object.keys(grouped).sort()).toEqual(["abcd", "wxyz"]);
    expect(grouped.wxyz).toHaveLength(2);

    const profiles = buildOpponentTeamProfiles(grouped);
    expect(profiles.map((p) => p.teamId).sort()).toEqual(["abcd", "wxyz"]);
    expect(profiles.find((p) => p.teamId === "wxyz")?.roundsRecorded).toBe(2);
  });
});

describe("getHeadToHeadRecords", () => {
  it("filters down to rounds recorded against a specific opponent", () => {
    const records = [
      record({ opponentTeamId: "rival" }),
      record({ opponentTeamId: "other" }),
      record({ opponentTeamId: "rival" }),
      record({}),
    ];
    const headToHead = getHeadToHeadRecords(records, "rival");
    expect(headToHead).toHaveLength(2);
    expect(headToHead.every((r) => r.opponentTeamId === "rival")).toBe(true);
  });

  it("returns an empty list when no rounds tracked that opponent", () => {
    expect(getHeadToHeadRecords([record({ opponentTeamId: "other" })], "rival")).toEqual([]);
  });
});

describe("buildOpponentScoutingSummary", () => {
  it("reports no recorded rounds for an empty history", () => {
    const profile = buildOpponentTeamProfile("empty", []);
    expect(buildOpponentScoutingSummary(profile)).toBe("empty: no recorded rounds on file.");
  });

  it("includes record, side record, and tag/case lines", () => {
    const profile = buildOpponentTeamProfile("wxyz", [
      record({ side: "aff", won: true, argumentTags: ["kritik"], caseName: "Warming Aff" }),
      record({ side: "neg", won: false }),
    ]);
    const summary = buildOpponentScoutingSummary(profile);
    expect(summary).toContain("wxyz: 2 round(s) recorded across 1 tournament(s).");
    expect(summary).toContain("Record: 1-1");
    expect(summary).toContain("Side record: Aff 1-0, Neg 0-1");
    expect(summary).toContain("Common arguments: kritik (1)");
    expect(summary).toContain("Common cases: Warming Aff (1)");
  });

  it("flags unknown tags/cases instead of fabricating a value", () => {
    const profile = buildOpponentTeamProfile("wxyz", [record()]);
    const summary = buildOpponentScoutingSummary(profile);
    expect(summary).toContain("Common arguments: unknown (no tags recorded)");
    expect(summary).toContain("Common cases: unknown (no case names recorded)");
  });

  it("notes a notable side preference when flagged", () => {
    const records = [
      ...Array.from({ length: 4 }, () => record({ side: "aff", won: true })),
      record({ side: "neg", won: false }),
    ];
    const summary = buildOpponentScoutingSummary(buildOpponentTeamProfile("skewed", records));
    expect(summary).toContain("(notably stronger on aff)");
  });
});

describe("buildOpponentScoutingReportText", () => {
  it("reports an empty roster without crashing", () => {
    const text = buildOpponentScoutingReportText([]);
    expect(text).toContain("Opponent Scouting Report");
    expect(text).toContain("No opponent team profiles are on file yet.");
  });

  it("includes one summary block per roster entry, in the given order", () => {
    const alpha = buildOpponentTeamProfile("alpha", [
      record({ teamId: "alpha", side: "aff", won: true }),
    ]);
    const beta = buildOpponentTeamProfile("beta", [
      record({ teamId: "beta", side: "neg", won: false }),
    ]);
    const text = buildOpponentScoutingReportText([alpha, beta]);
    expect(text.startsWith("Opponent Scouting Report\n\n")).toBe(true);
    expect(text.indexOf("alpha:")).toBeLessThan(text.indexOf("beta:"));
    expect(text).toContain(buildOpponentScoutingSummary(alpha));
    expect(text).toContain(buildOpponentScoutingSummary(beta));
  });
});

describe("opponentScoutingReportFilename", () => {
  it("returns a fixed filename", () => {
    expect(opponentScoutingReportFilename()).toBe("opponent-scouting-report.txt");
  });
});

describe("buildOpponentTeamComparison", () => {
  it("splits argument tags into shared, a-only, and b-only, ranked by frequency", () => {
    const a = buildOpponentTeamProfile("us", [
      record({ teamId: "us", argumentTags: ["kritik"] }),
      record({ teamId: "us", argumentTags: ["kritik"] }),
      record({ teamId: "us", argumentTags: ["topicality"] }),
    ]);
    const b = buildOpponentTeamProfile("rival", [
      record({ teamId: "rival", argumentTags: ["kritik"] }),
      record({ teamId: "rival", argumentTags: ["counterplan"] }),
    ]);
    const comparison = buildOpponentTeamComparison(a, b);
    expect(comparison.a.teamId).toBe("us");
    expect(comparison.b.teamId).toBe("rival");
    expect(comparison.sharedArgumentTags).toEqual([{ value: "kritik", count: 3 }]);
    expect(comparison.aOnlyArgumentTags).toEqual([{ value: "topicality", count: 1 }]);
    expect(comparison.bOnlyArgumentTags).toEqual([{ value: "counterplan", count: 1 }]);
  });

  it("handles a team with no recorded rounds on either side without crashing", () => {
    const a = buildOpponentTeamProfile("us", []);
    const b = buildOpponentTeamProfile("rival", []);
    const comparison = buildOpponentTeamComparison(a, b);
    expect(comparison.sharedArgumentTags).toEqual([]);
    expect(comparison.aOnlyArgumentTags).toEqual([]);
    expect(comparison.bOnlyArgumentTags).toEqual([]);
  });

  it("ties in shared/only tags alphabetically", () => {
    const a = buildOpponentTeamProfile("us", [
      record({ teamId: "us", argumentTags: ["zeta"] }),
      record({ teamId: "us", argumentTags: ["alpha"] }),
    ]);
    const b = buildOpponentTeamProfile("rival", []);
    const comparison = buildOpponentTeamComparison(a, b);
    expect(comparison.aOnlyArgumentTags).toEqual([
      { value: "alpha", count: 1 },
      { value: "zeta", count: 1 },
    ]);
  });
});

describe("buildOpponentTeamComparisonText", () => {
  it("renders both teams' records, side records, and tag breakdown", () => {
    const a = buildOpponentTeamProfile("us", [
      record({ teamId: "us", side: "aff", won: true, argumentTags: ["kritik"] }),
    ]);
    const b = buildOpponentTeamProfile("rival", [
      record({ teamId: "rival", side: "neg", won: false, argumentTags: ["kritik"] }),
    ]);
    const text = buildOpponentTeamComparisonText(buildOpponentTeamComparison(a, b));
    expect(text).toContain("Opponent Comparison — us vs. rival");
    expect(text).toContain("Rounds recorded: us 1, rival 1");
    expect(text).toContain("Record: us 1-0 (100%), rival 0-1 (0%)");
    expect(text).toContain("Aff record: us 1-0 (100%), rival —");
    expect(text).toContain("Neg record: us —, rival 0-1 (0%)");
    expect(text).toContain("Shared arguments: kritik (2)");
    expect(text).toContain("us-only arguments: none");
    expect(text).toContain("rival-only arguments: none");
  });

  it("reports 'no recorded rounds' for a team with an empty history", () => {
    const a = buildOpponentTeamProfile("us", []);
    const b = buildOpponentTeamProfile("rival", [record({ teamId: "rival" })]);
    const text = buildOpponentTeamComparisonText(buildOpponentTeamComparison(a, b));
    expect(text).toContain("Record: us no recorded rounds, rival 1-0 (100%)");
  });
});

describe("opponentTeamComparisonFilename", () => {
  it("builds a sanitized filename from both team ids", () => {
    const a = buildOpponentTeamProfile("Us Team!", []);
    const b = buildOpponentTeamProfile("Westlake AB", []);
    expect(opponentTeamComparisonFilename(a, b)).toBe("opponent-comparison-us-team-vs-westlake-ab.txt");
  });
});

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
