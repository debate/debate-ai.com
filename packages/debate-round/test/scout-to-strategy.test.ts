import { beforeEach, describe, expect, it } from "vitest";
import type { OpponentRoundRecord } from "debate-data-sync/src/rankings/opponent-team-profile";
import { buildOpponentTeamProfile } from "debate-data-sync/src/rankings/opponent-team-profile";
import { saveOpponentTeamProfile } from "debate-data-sync/src/state/opponentTeamProfiles";
import type { JudgeRoundRecord } from "debate-speech-writer/src/judge/judge-profile";
import { buildJudgeProfile } from "debate-speech-writer/src/judge/judge-profile";
import { saveJudgeProfile } from "debate-speech-writer/src/state/judgeProfiles";
import {
  assessMatchupRisk,
  buildJudgeAdaptationNotes,
  buildStrategyRecommendation,
  buildStrategyRecommendationFromStores,
  buildStrategyRecommendationText,
  computeCaseOverlapScore,
  getLikelyOpponentSide,
  rankCaseOptions,
  type CaseOption,
} from "../src/round/scout-to-strategy";

/** Minimal in-memory `localStorage` mock — this package's Vitest environment has no DOM by default here. */
class MemoryStorage {
  private store = new Map<string, string>();
  getItem(key: string): string | null {
    return this.store.has(key) ? this.store.get(key)! : null;
  }
  setItem(key: string, value: string): void {
    this.store.set(key, value);
  }
  removeItem(key: string): void {
    this.store.delete(key);
  }
  clear(): void {
    this.store.clear();
  }
}

function opponentRecords(overrides: Partial<OpponentRoundRecord>[] = []): OpponentRoundRecord[] {
  const base: OpponentRoundRecord[] = [
    {
      teamId: "OpponentA",
      tournamentName: "Blake",
      date: "2026-01-01",
      division: "LD",
      side: "neg",
      won: true,
      argumentTags: ["kritik", "topicality"],
    },
    {
      teamId: "OpponentA",
      tournamentName: "Blake",
      date: "2026-01-02",
      division: "LD",
      side: "neg",
      won: true,
      argumentTags: ["kritik"],
    },
    {
      teamId: "OpponentA",
      tournamentName: "Greenhill",
      date: "2026-02-01",
      division: "LD",
      side: "aff",
      won: true,
      argumentTags: ["policy-affirmative"],
    },
    {
      teamId: "OpponentA",
      tournamentName: "Greenhill",
      date: "2026-02-02",
      division: "LD",
      side: "aff",
      won: true,
      argumentTags: ["policy-affirmative"],
    },
    {
      teamId: "OpponentA",
      tournamentName: "Greenhill",
      date: "2026-02-03",
      division: "LD",
      side: "aff",
      won: false,
      argumentTags: ["policy-affirmative"],
    },
  ];
  return overrides.length > 0 ? (overrides as OpponentRoundRecord[]) : base;
}

function judgeRecords(): JudgeRoundRecord[] {
  return [
    {
      judgeId: "J. Smith",
      tournamentName: "Blake",
      date: "2026-01-01",
      division: "LD",
      winningSide: "aff",
      affSpeakerPoints: 28,
      negSpeakerPoints: 27,
      paceWpm: 320,
      theoryArgumentRaised: true,
      theoryArgumentWon: false,
      paradigmId: "flow",
    },
    {
      judgeId: "J. Smith",
      tournamentName: "Blake",
      date: "2026-01-02",
      division: "LD",
      winningSide: "aff",
      affSpeakerPoints: 29,
      negSpeakerPoints: 26,
      paceWpm: 330,
      theoryArgumentRaised: true,
      theoryArgumentWon: false,
      paradigmId: "flow",
    },
    {
      judgeId: "J. Smith",
      tournamentName: "Blake",
      date: "2026-01-03",
      division: "LD",
      winningSide: "aff",
      affSpeakerPoints: 28,
      negSpeakerPoints: 27,
      paceWpm: 325,
      theoryArgumentRaised: true,
      theoryArgumentWon: false,
      paradigmId: "flow",
    },
    {
      judgeId: "J. Smith",
      tournamentName: "Blake",
      date: "2026-01-04",
      division: "LD",
      winningSide: "aff",
      affSpeakerPoints: 28,
      negSpeakerPoints: 27,
      paceWpm: 330,
      theoryArgumentRaised: true,
      theoryArgumentWon: true,
      paradigmId: "flow",
    },
    {
      judgeId: "J. Smith",
      tournamentName: "Blake",
      date: "2026-01-05",
      division: "LD",
      winningSide: "aff",
      affSpeakerPoints: 28,
      negSpeakerPoints: 27,
      paceWpm: 330,
      theoryArgumentRaised: false,
      theoryArgumentWon: false,
      paradigmId: "flow",
    },
  ];
}

const CASE_OPTIONS: CaseOption[] = [
  { name: "Case B", argumentTags: ["kritik"] },
  { name: "Case A", argumentTags: ["policy-affirmative"] },
  { name: "Case C", argumentTags: ["disadvantage"] },
];

describe("computeCaseOverlapScore", () => {
  it("returns 0 when no opponent profile is supplied", () => {
    expect(computeCaseOverlapScore({ name: "Case A", argumentTags: ["kritik"] })).toBe(0);
  });

  it("returns 0 when the opponent profile has no tracked tags", () => {
    const opponentProfile = buildOpponentTeamProfile("OpponentA", []);
    expect(computeCaseOverlapScore({ name: "Case A", argumentTags: ["kritik"] }, opponentProfile)).toBe(0);
  });

  it("sums the opponent's recorded frequency for each of the option's tags", () => {
    const opponentProfile = buildOpponentTeamProfile("OpponentA", opponentRecords());
    // "kritik" appears twice in the opponent's history.
    expect(computeCaseOverlapScore({ name: "Case B", argumentTags: ["kritik"] }, opponentProfile)).toBe(2);
    // "policy-affirmative" appears three times.
    expect(
      computeCaseOverlapScore({ name: "Case A", argumentTags: ["policy-affirmative"] }, opponentProfile),
    ).toBe(3);
  });

  it("ignores tags the opponent has never run", () => {
    const opponentProfile = buildOpponentTeamProfile("OpponentA", opponentRecords());
    expect(computeCaseOverlapScore({ name: "Case C", argumentTags: ["disadvantage"] }, opponentProfile)).toBe(0);
  });
});

describe("rankCaseOptions", () => {
  it("scores every option at 0 and tie-breaks alphabetically when no opponent profile is supplied", () => {
    const ranked = rankCaseOptions(CASE_OPTIONS);
    expect(ranked.map((r) => r.name)).toEqual(["Case A", "Case B", "Case C"]);
    expect(ranked.every((r) => r.overlapScore === 0)).toBe(true);
  });

  it("ranks the lowest-overlap option first when an opponent profile is supplied", () => {
    const opponentProfile = buildOpponentTeamProfile("OpponentA", opponentRecords());
    const ranked = rankCaseOptions(CASE_OPTIONS, opponentProfile);
    // Case C (0) < Case B (2, kritik) < Case A (3, policy-affirmative)
    expect(ranked.map((r) => r.name)).toEqual(["Case C", "Case B", "Case A"]);
    expect(ranked.map((r) => r.overlapScore)).toEqual([0, 2, 3]);
  });

  it("returns an empty list for an empty input", () => {
    expect(rankCaseOptions([])).toEqual([]);
  });
});

describe("buildJudgeAdaptationNotes", () => {
  it("returns fallback text when no judge profile is supplied", () => {
    expect(buildJudgeAdaptationNotes()).toEqual([
      "No judge tendency data on file — adapt to a generic flow judge by default.",
    ]);
  });

  it("returns fallback text when the judge profile has no judged rounds", () => {
    const judgeProfile = buildJudgeProfile("J. Smith", []);
    expect(buildJudgeAdaptationNotes(judgeProfile)).toEqual([
      "No judge tendency data on file — adapt to a generic flow judge by default.",
    ]);
  });

  it("notes low speed tolerance, low theory receptiveness, and no side bias/paradigm", () => {
    const judgeProfile = buildJudgeProfile("J. Slow", [
      {
        judgeId: "J. Slow",
        tournamentName: "Blake",
        date: "2026-01-01",
        division: "LD",
        winningSide: "aff",
        affSpeakerPoints: 28,
        negSpeakerPoints: 27,
        paceWpm: 150,
        theoryArgumentRaised: true,
        theoryArgumentWon: false,
      },
    ]);
    const notes = buildJudgeAdaptationNotes(judgeProfile);
    expect(notes).toContain("Slow down delivery — this judge has a low tracked speed tolerance.");
    expect(notes).toContain("Avoid leaning on theory arguments — this judge rarely votes on them.");
  });

  it("notes high theory receptiveness", () => {
    const judgeProfile = buildJudgeProfile("J. Theory", [
      {
        judgeId: "J. Theory",
        tournamentName: "Blake",
        date: "2026-01-01",
        division: "LD",
        winningSide: "aff",
        affSpeakerPoints: 28,
        negSpeakerPoints: 27,
        theoryArgumentRaised: true,
        theoryArgumentWon: true,
      },
      {
        judgeId: "J. Theory",
        tournamentName: "Blake",
        date: "2026-01-02",
        division: "LD",
        winningSide: "neg",
        affSpeakerPoints: 27,
        negSpeakerPoints: 28,
        theoryArgumentRaised: true,
        theoryArgumentWon: true,
      },
      {
        judgeId: "J. Theory",
        tournamentName: "Blake",
        date: "2026-01-03",
        division: "LD",
        winningSide: "aff",
        affSpeakerPoints: 28,
        negSpeakerPoints: 27,
        theoryArgumentRaised: true,
        theoryArgumentWon: false,
      },
    ]);
    const notes = buildJudgeAdaptationNotes(judgeProfile);
    expect(notes).toContain("Theory arguments are viable — this judge often votes on them.");
  });

  it("notes high speed tolerance, high theory receptiveness, side bias, and most-tagged paradigm", () => {
    const judgeProfile = buildJudgeProfile("J. Smith", judgeRecords());
    const notes = buildJudgeAdaptationNotes(judgeProfile);
    expect(notes).toContain("Full speed is fine — this judge tracks high-pace delivery well.");
    expect(notes).toContain("This judge has historically favored the aff side.");
    expect(notes).toContain("Most-tagged paradigm: flow — frame weighing accordingly.");
  });

  it("notes a neg-favoring side bias", () => {
    const negFavoringRecords: JudgeRoundRecord[] = judgeRecords().map((record) => ({
      ...record,
      judgeId: "J. NegLean",
      winningSide: "neg",
      affSpeakerPoints: 26,
      negSpeakerPoints: 29,
    }));
    const judgeProfile = buildJudgeProfile("J. NegLean", negFavoringRecords);
    const notes = buildJudgeAdaptationNotes(judgeProfile);
    expect(notes).toContain("This judge has historically favored the neg side.");
  });

  it("falls back to a generic note when a judge has judged rounds but no notable tendencies", () => {
    const judgeProfile = buildJudgeProfile("J. Neutral", [
      {
        judgeId: "J. Neutral",
        tournamentName: "Blake",
        date: "2026-01-01",
        division: "LD",
        winningSide: "aff",
        affSpeakerPoints: 28,
        negSpeakerPoints: 27,
        theoryArgumentRaised: false,
        theoryArgumentWon: false,
      },
    ]);
    expect(buildJudgeAdaptationNotes(judgeProfile)).toEqual([
      "No strong tendencies detected — adapt based on in-round reads.",
    ]);
  });
});

describe("assessMatchupRisk", () => {
  it("returns low risk with no factors when nothing is supplied", () => {
    expect(assessMatchupRisk()).toEqual({ riskLevel: "low", riskFactors: [] });
  });

  it("ignores an opponent profile with no recorded rounds", () => {
    const opponentProfile = buildOpponentTeamProfile("OpponentA", []);
    expect(assessMatchupRisk(opponentProfile)).toEqual({ riskLevel: "low", riskFactors: [] });
  });

  it("flags a single risk factor as medium risk", () => {
    const judgeProfile = buildJudgeProfile("J. Smith", judgeRecords());
    const { riskLevel, riskFactors } = assessMatchupRisk(undefined, judgeProfile);
    expect(riskLevel).toBe("medium");
    expect(riskFactors).toEqual(["Judge has a notable historical side bias toward aff."]);
  });

  it("flags a neg-favoring judge side bias", () => {
    const negFavoringRecords: JudgeRoundRecord[] = judgeRecords().map((record) => ({
      ...record,
      judgeId: "J. NegLean",
      winningSide: "neg",
      affSpeakerPoints: 26,
      negSpeakerPoints: 29,
    }));
    const judgeProfile = buildJudgeProfile("J. NegLean", negFavoringRecords);
    const { riskFactors } = assessMatchupRisk(undefined, judgeProfile);
    expect(riskFactors).toEqual(["Judge has a notable historical side bias toward neg."]);
  });

  it("finds no risk factors from an opponent with recorded rounds below both thresholds", () => {
    const opponentProfile = buildOpponentTeamProfile("OpponentB", [
      {
        teamId: "OpponentB",
        tournamentName: "Blake",
        date: "2026-01-01",
        division: "LD",
        side: "aff",
        won: true,
      },
      {
        teamId: "OpponentB",
        tournamentName: "Blake",
        date: "2026-01-02",
        division: "LD",
        side: "neg",
        won: false,
      },
      {
        teamId: "OpponentB",
        tournamentName: "Blake",
        date: "2026-01-03",
        division: "LD",
        side: "aff",
        won: false,
      },
    ]);
    expect(assessMatchupRisk(opponentProfile)).toEqual({ riskLevel: "low", riskFactors: [] });
  });

  it("flags a strong opponent win rate and side preference as high risk", () => {
    const opponentProfile = buildOpponentTeamProfile("OpponentA", opponentRecords());
    const { riskLevel, riskFactors } = assessMatchupRisk(opponentProfile);
    expect(riskLevel).toBe("high");
    expect(riskFactors).toEqual([
      "Opponent has a strong overall record (80% win rate across 5 round(s)).",
      "Opponent performs notably better on the neg side.",
    ]);
  });

  it("combines opponent and judge risk factors", () => {
    const opponentProfile = buildOpponentTeamProfile("OpponentA", opponentRecords());
    const judgeProfile = buildJudgeProfile("J. Smith", judgeRecords());
    const { riskLevel, riskFactors } = assessMatchupRisk(opponentProfile, judgeProfile);
    expect(riskLevel).toBe("high");
    expect(riskFactors).toHaveLength(3);
  });
});

describe("getLikelyOpponentSide", () => {
  it("returns neg when we're running aff, and aff when we're running neg", () => {
    expect(getLikelyOpponentSide("aff")).toBe("neg");
    expect(getLikelyOpponentSide("neg")).toBe("aff");
  });
});

describe("assessMatchupRisk with ourSide", () => {
  /** Opponent below the overall win-rate threshold (4/7 ≈ 57%) so only the side-specific signal is under test — strong on neg (4/4), weak on aff (0/3). */
  function sideAwareOpponentRecords(): OpponentRoundRecord[] {
    const negWins: OpponentRoundRecord[] = Array.from({ length: 4 }, (_, i) => ({
      teamId: "OpponentSide",
      tournamentName: "Blake",
      date: `2026-01-0${i + 1}`,
      division: "LD",
      side: "neg",
      won: true,
    }));
    const affLosses: OpponentRoundRecord[] = Array.from({ length: 3 }, (_, i) => ({
      teamId: "OpponentSide",
      tournamentName: "Blake",
      date: `2026-02-0${i + 1}`,
      division: "LD",
      side: "aff",
      won: false,
    }));
    return [...negWins, ...affLosses];
  }

  it("flags the opponent's strong record on the side they'll likely run against us", () => {
    const opponentProfile = buildOpponentTeamProfile("OpponentSide", sideAwareOpponentRecords());
    // We're aff, so the opponent will likely run neg — where they're 4-0.
    const { riskLevel, riskFactors } = assessMatchupRisk(opponentProfile, undefined, "aff");
    expect(riskFactors).toEqual([
      "Opponent has a strong record on neg (100% win rate across 4 round(s)) — the side they'll likely run against us.",
    ]);
    expect(riskLevel).toBe("medium");
  });

  it("does not flag the opponent's weak side even though their overall side preference is notable", () => {
    const opponentProfile = buildOpponentTeamProfile("OpponentSide", sideAwareOpponentRecords());
    // We're neg, so the opponent will likely run aff — where they're 0-3, not a risk to us.
    const { riskLevel, riskFactors } = assessMatchupRisk(opponentProfile, undefined, "neg");
    expect(riskFactors).toEqual([]);
    expect(riskLevel).toBe("low");
  });

  it("ignores an opponent's likely-side record below the minimum-rounds threshold", () => {
    // Only 1 neg round (below the 2-round side-specific threshold); overall win rate (1/3) is
    // also below the overall-record threshold, so no risk factor should fire from either check.
    const opponentProfile = buildOpponentTeamProfile("OpponentThin", [
      { teamId: "OpponentThin", tournamentName: "Blake", date: "2026-01-01", division: "LD", side: "neg", won: true },
      { teamId: "OpponentThin", tournamentName: "Blake", date: "2026-01-02", division: "LD", side: "aff", won: false },
      { teamId: "OpponentThin", tournamentName: "Blake", date: "2026-01-03", division: "LD", side: "aff", won: false },
    ]);
    const { riskFactors } = assessMatchupRisk(opponentProfile, undefined, "aff");
    expect(riskFactors).toEqual([]);
  });

  it("flags a judge side bias toward the side the opponent will likely run against us", () => {
    const judgeProfile = buildJudgeProfile("J. Smith", judgeRecords()); // favors aff
    // We're neg, so the opponent will likely run aff — the judge's favored side.
    const { riskFactors } = assessMatchupRisk(undefined, judgeProfile, "neg");
    expect(riskFactors).toEqual([
      "Judge has a notable historical side bias toward aff — the side the opponent will likely run against us.",
    ]);
  });

  it("does not flag a judge side bias toward our own side", () => {
    const judgeProfile = buildJudgeProfile("J. Smith", judgeRecords()); // favors aff
    // We're aff, so the judge's bias favors us, not the opponent.
    const { riskFactors } = assessMatchupRisk(undefined, judgeProfile, "aff");
    expect(riskFactors).toEqual([]);
  });
});

describe("buildStrategyRecommendation", () => {
  it("returns a null recommended case and empty rankings when no case options are supplied", () => {
    const recommendation = buildStrategyRecommendation({ caseOptions: [] });
    expect(recommendation.recommendedCase).toBeNull();
    expect(recommendation.caseRankings).toEqual([]);
  });

  it("composes case ranking, judge notes, and risk level from every supplied input", () => {
    const opponentProfile = buildOpponentTeamProfile("OpponentA", opponentRecords());
    const judgeProfile = buildJudgeProfile("J. Smith", judgeRecords());

    const recommendation = buildStrategyRecommendation({
      caseOptions: CASE_OPTIONS,
      opponentProfile,
      judgeProfile,
    });

    expect(recommendation.recommendedCase?.name).toBe("Case C");
    expect(recommendation.caseRankings.map((c) => c.name)).toEqual(["Case C", "Case B", "Case A"]);
    expect(recommendation.judgeAdaptationNotes.length).toBeGreaterThan(0);
    expect(recommendation.riskLevel).toBe("high");
  });

  it("threads ourSide into the risk heuristic, scoping factors to the likely opponent side", () => {
    const opponentProfile = buildOpponentTeamProfile("OpponentA", opponentRecords());
    const judgeProfile = buildJudgeProfile("J. Smith", judgeRecords()); // favors aff

    const recommendation = buildStrategyRecommendation({
      caseOptions: CASE_OPTIONS,
      opponentProfile,
      judgeProfile,
      ourSide: "aff",
    });

    // Opponent is 2-0 on neg (the side they'll likely run against us) and 80% overall — both flag.
    // The judge favors aff (our own side), so no judge risk factor is included.
    expect(recommendation.riskFactors).toEqual([
      "Opponent has a strong overall record (80% win rate across 5 round(s)).",
      "Opponent has a strong record on neg (100% win rate across 2 round(s)) — the side they'll likely run against us.",
    ]);
  });
});

describe("buildStrategyRecommendationText", () => {
  it("renders 'no case options supplied' lines when caseOptions is empty", () => {
    const recommendation = buildStrategyRecommendation({ caseOptions: [] });
    const text = buildStrategyRecommendationText(recommendation);
    expect(text).toContain("### Recommended case\nNo case options supplied.");
    expect(text).toContain("### Case rankings\nNo case options supplied.");
  });

  it("renders 'no notable risk factors' when the risk level is low", () => {
    const recommendation = buildStrategyRecommendation({ caseOptions: [] });
    const text = buildStrategyRecommendationText(recommendation);
    expect(text).toContain("### Risk level: low\n- No notable risk factors detected.");
  });

  it("renders every section for a fully populated recommendation", () => {
    const opponentProfile = buildOpponentTeamProfile("OpponentA", opponentRecords());
    const judgeProfile = buildJudgeProfile("J. Smith", judgeRecords());
    const recommendation = buildStrategyRecommendation({
      caseOptions: CASE_OPTIONS,
      opponentProfile,
      judgeProfile,
    });
    const text = buildStrategyRecommendationText(recommendation);

    expect(text).toContain("### Recommended case\nCase C (overlap score: 0)");
    expect(text).toContain("- Case C (overlap score: 0)");
    expect(text).toContain("- Case B (overlap score: 2)");
    expect(text).toContain("- Case A (overlap score: 3)");
    expect(text).toContain("### Judge adaptation");
    expect(text).toContain("### Risk level: high");
  });
});

describe("buildStrategyRecommendationFromStores", () => {
  beforeEach(() => {
    (globalThis as unknown as { localStorage: MemoryStorage }).localStorage = new MemoryStorage();
  });

  it("resolves opponent/judge profiles from the persisted stores by id", () => {
    saveOpponentTeamProfile(buildOpponentTeamProfile("OpponentA", opponentRecords()));
    saveJudgeProfile(buildJudgeProfile("J. Smith", judgeRecords()));

    const recommendation = buildStrategyRecommendationFromStores({
      caseOptions: CASE_OPTIONS,
      opponentTeamId: "OpponentA",
      judgeId: "J. Smith",
    });

    expect(recommendation.recommendedCase?.name).toBe("Case C");
    expect(recommendation.riskLevel).toBe("high");
  });

  it("falls back to the no-data defaults when nothing is persisted for the given ids", () => {
    const recommendation = buildStrategyRecommendationFromStores({
      caseOptions: CASE_OPTIONS,
      opponentTeamId: "Unknown",
      judgeId: "Unknown",
    });

    expect(recommendation.caseRankings.every((c) => c.overlapScore === 0)).toBe(true);
    expect(recommendation.judgeAdaptationNotes).toEqual([
      "No judge tendency data on file — adapt to a generic flow judge by default.",
    ]);
  });

  it("prefers an explicitly supplied profile over a store lookup", () => {
    saveOpponentTeamProfile(buildOpponentTeamProfile("OpponentA", opponentRecords()));
    const explicitProfile = buildOpponentTeamProfile("OpponentA (explicit)", []);

    const recommendation = buildStrategyRecommendationFromStores({
      caseOptions: CASE_OPTIONS,
      opponentTeamId: "OpponentA",
      opponentProfile: explicitProfile,
    });

    expect(recommendation.caseRankings.every((c) => c.overlapScore === 0)).toBe(true);
  });

  it("behaves like buildStrategyRecommendation when no ids or profiles are supplied", () => {
    const recommendation = buildStrategyRecommendationFromStores({ caseOptions: CASE_OPTIONS });
    expect(recommendation).toEqual(buildStrategyRecommendation({ caseOptions: CASE_OPTIONS }));
  });

  it("threads ourSide through to the resolved profiles' risk assessment", () => {
    saveOpponentTeamProfile(buildOpponentTeamProfile("OpponentA", opponentRecords()));
    saveJudgeProfile(buildJudgeProfile("J. Smith", judgeRecords()));

    const withSide = buildStrategyRecommendationFromStores({
      caseOptions: CASE_OPTIONS,
      opponentTeamId: "OpponentA",
      judgeId: "J. Smith",
      ourSide: "aff",
    });
    const withoutSide = buildStrategyRecommendationFromStores({
      caseOptions: CASE_OPTIONS,
      opponentTeamId: "OpponentA",
      judgeId: "J. Smith",
    });

    expect(withSide.riskFactors).not.toEqual(withoutSide.riskFactors);
    expect(withSide.riskFactors).toEqual([
      "Opponent has a strong overall record (80% win rate across 5 round(s)).",
      "Opponent has a strong record on neg (100% win rate across 2 round(s)) — the side they'll likely run against us.",
    ]);
  });
});
