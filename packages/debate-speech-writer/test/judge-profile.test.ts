import { describe, expect, it } from "vitest";
import {
  DEFAULT_SPEED_THRESHOLDS_WPM,
  buildJudgeProfile,
  buildJudgeProfiles,
  buildJudgeTendencySummary,
  classifySpeedTolerance,
  classifyTheoryReceptiveness,
  groupRecordsByJudge,
  type JudgeRoundRecord,
} from "../src/judge/judge-profile";

function record(overrides: Partial<JudgeRoundRecord> = {}): JudgeRoundRecord {
  return {
    judgeId: "smith",
    tournamentName: "Berkeley",
    date: "2026-01-01",
    division: "PF",
    winningSide: "aff",
    affSpeakerPoints: 28,
    negSpeakerPoints: 27,
    theoryArgumentRaised: false,
    theoryArgumentWon: false,
    ...overrides,
  };
}

describe("classifySpeedTolerance", () => {
  it("buckets pace at or below the low threshold as low", () => {
    expect(classifySpeedTolerance(DEFAULT_SPEED_THRESHOLDS_WPM.low)).toBe("low");
    expect(classifySpeedTolerance(150)).toBe("low");
  });

  it("buckets pace between the thresholds as medium", () => {
    expect(classifySpeedTolerance(250)).toBe("medium");
    expect(classifySpeedTolerance(DEFAULT_SPEED_THRESHOLDS_WPM.medium)).toBe("medium");
  });

  it("buckets pace above the medium threshold as high", () => {
    expect(classifySpeedTolerance(350)).toBe("high");
  });

  it("honors custom thresholds", () => {
    expect(classifySpeedTolerance(120, { low: 100, medium: 200 })).toBe("medium");
  });
});

describe("classifyTheoryReceptiveness", () => {
  it("buckets a low win rate as low", () => {
    expect(classifyTheoryReceptiveness(0)).toBe("low");
    expect(classifyTheoryReceptiveness(0.2)).toBe("low");
  });

  it("buckets a middling win rate as medium", () => {
    expect(classifyTheoryReceptiveness(0.5)).toBe("medium");
  });

  it("buckets a high win rate as high", () => {
    expect(classifyTheoryReceptiveness(0.8)).toBe("high");
    expect(classifyTheoryReceptiveness(1)).toBe("high");
  });
});

describe("buildJudgeProfile", () => {
  it("returns a zeroed profile with no null-crash for a judge with no rounds", () => {
    const profile = buildJudgeProfile("empty", []);
    expect(profile.roundsJudged).toBe(0);
    expect(profile.tournamentsJudged).toBe(0);
    expect(profile.sideBias).toEqual({
      affWins: 0,
      negWins: 0,
      affWinRate: 0,
      negWinRate: 0,
      hasNotableSideBias: false,
    });
    expect(profile.avgSpeakerPoints).toEqual({ aff: 0, neg: 0, overall: 0 });
    expect(profile.speedTolerance).toBeNull();
    expect(profile.avgPaceWpm).toBeNull();
    expect(profile.theoryReceptiveness).toBeNull();
    expect(profile.theoryWinRate).toBeNull();
    expect(profile.mostCommonParadigm).toBeNull();
    expect(profile.mostCommonParadigmConfidence).toBeNull();
  });

  it("counts side wins and unique tournaments across the history", () => {
    const profile = buildJudgeProfile("smith", [
      record({ tournamentName: "Berkeley", winningSide: "aff" }),
      record({ tournamentName: "Berkeley", winningSide: "neg" }),
      record({ tournamentName: "Harvard", winningSide: "aff" }),
    ]);
    expect(profile.roundsJudged).toBe(3);
    expect(profile.tournamentsJudged).toBe(2);
    expect(profile.sideBias.affWins).toBe(2);
    expect(profile.sideBias.negWins).toBe(1);
    expect(profile.sideBias.affWinRate).toBeCloseTo(2 / 3);
  });

  it("flags a notable side bias once there are enough rounds and a skewed rate", () => {
    const records = [
      ...Array.from({ length: 5 }, () => record({ winningSide: "aff" })),
      record({ winningSide: "neg" }),
    ];
    const profile = buildJudgeProfile("skewed", records);
    expect(profile.roundsJudged).toBe(6);
    expect(profile.sideBias.affWinRate).toBeCloseTo(5 / 6);
    expect(profile.sideBias.hasNotableSideBias).toBe(true);
  });

  it("does not flag side bias below the minimum sample size even if fully one-sided", () => {
    const records = Array.from({ length: 3 }, () => record({ winningSide: "aff" }));
    const profile = buildJudgeProfile("small-sample", records);
    expect(profile.sideBias.affWinRate).toBe(1);
    expect(profile.sideBias.hasNotableSideBias).toBe(false);
  });

  it("does not flag side bias when the rate is close to even", () => {
    const records = [
      ...Array.from({ length: 3 }, () => record({ winningSide: "aff" })),
      ...Array.from({ length: 3 }, () => record({ winningSide: "neg" })),
    ];
    const profile = buildJudgeProfile("even", records);
    expect(profile.sideBias.hasNotableSideBias).toBe(false);
  });

  it("averages speaker points awarded to each side and overall", () => {
    const profile = buildJudgeProfile("smith", [
      record({ affSpeakerPoints: 30, negSpeakerPoints: 28 }),
      record({ affSpeakerPoints: 28, negSpeakerPoints: 26 }),
    ]);
    expect(profile.avgSpeakerPoints).toEqual({ aff: 29, neg: 27, overall: 28 });
  });

  it("computes speed tolerance only from rounds that tracked pace", () => {
    const profile = buildJudgeProfile("smith", [
      record({ paceWpm: 350 }),
      record({ paceWpm: 250 }),
      record(),
    ]);
    expect(profile.avgPaceWpm).toBe(300);
    expect(profile.speedTolerance).toBe("medium");
  });

  it("leaves speed tolerance null when no round tracked pace", () => {
    const profile = buildJudgeProfile("smith", [record(), record()]);
    expect(profile.avgPaceWpm).toBeNull();
    expect(profile.speedTolerance).toBeNull();
  });

  it("computes theory receptiveness only from rounds that raised theory", () => {
    const profile = buildJudgeProfile("smith", [
      record({ theoryArgumentRaised: true, theoryArgumentWon: true }),
      record({ theoryArgumentRaised: true, theoryArgumentWon: false }),
      record({ theoryArgumentRaised: false }),
    ]);
    expect(profile.roundsWithTheoryRaised).toBe(2);
    expect(profile.theoryWinRate).toBe(0.5);
    expect(profile.theoryReceptiveness).toBe("medium");
  });

  it("leaves theory receptiveness null when theory was never raised", () => {
    const profile = buildJudgeProfile("smith", [record(), record()]);
    expect(profile.theoryWinRate).toBeNull();
    expect(profile.theoryReceptiveness).toBeNull();
  });

  it("reports the most frequently tagged paradigm, tie-broken alphabetically", () => {
    const profile = buildJudgeProfile("smith", [
      record({ paradigmId: "flow" }),
      record({ paradigmId: "flow" }),
      record({ paradigmId: "lay" }),
    ]);
    expect(profile.mostCommonParadigm).toBe("flow");
  });

  it("breaks a paradigm tie alphabetically for a deterministic result", () => {
    const profile = buildJudgeProfile("smith", [
      record({ paradigmId: "lay" }),
      record({ paradigmId: "critic" }),
    ]);
    expect(profile.mostCommonParadigm).toBe("critic");
  });

  it("reports the most-common paradigm's confidence as its share of tagged rounds", () => {
    const profile = buildJudgeProfile("smith", [
      record({ paradigmId: "flow" }),
      record({ paradigmId: "flow" }),
      record({ paradigmId: "lay" }),
    ]);
    expect(profile.mostCommonParadigmConfidence).toBeCloseTo(2 / 3);
  });

  it("reports full confidence when every tagged round agrees", () => {
    const profile = buildJudgeProfile("smith", [
      record({ paradigmId: "flow" }),
      record({ paradigmId: "flow" }),
    ]);
    expect(profile.mostCommonParadigmConfidence).toBe(1);
  });

  it("ignores untagged rounds when computing confidence", () => {
    const profile = buildJudgeProfile("smith", [
      record({ paradigmId: "flow" }),
      record({ paradigmId: "flow" }),
      record(),
      record(),
      record(),
    ]);
    expect(profile.mostCommonParadigm).toBe("flow");
    expect(profile.mostCommonParadigmConfidence).toBe(1);
  });

  it("is null when no round tagged a paradigm", () => {
    const profile = buildJudgeProfile("smith", [record(), record()]);
    expect(profile.mostCommonParadigm).toBeNull();
    expect(profile.mostCommonParadigmConfidence).toBeNull();
  });
});

describe("groupRecordsByJudge / buildJudgeProfiles", () => {
  it("groups records by judgeId and builds one profile per judge", () => {
    const records = [
      record({ judgeId: "smith" }),
      record({ judgeId: "jones" }),
      record({ judgeId: "smith" }),
    ];
    const grouped = groupRecordsByJudge(records);
    expect(Object.keys(grouped).sort()).toEqual(["jones", "smith"]);
    expect(grouped.smith).toHaveLength(2);

    const profiles = buildJudgeProfiles(grouped);
    expect(profiles.map((p) => p.judgeId).sort()).toEqual(["jones", "smith"]);
    expect(profiles.find((p) => p.judgeId === "smith")?.roundsJudged).toBe(2);
  });
});

describe("buildJudgeTendencySummary", () => {
  it("reports no judged rounds for an empty history", () => {
    const profile = buildJudgeProfile("empty", []);
    expect(buildJudgeTendencySummary(profile)).toBe("empty: no judged rounds on record.");
  });

  it("includes side record, speaker points, speed, and theory lines", () => {
    const profile = buildJudgeProfile("smith", [
      record({ winningSide: "aff", paceWpm: 350, theoryArgumentRaised: true, theoryArgumentWon: true }),
      record({ winningSide: "neg" }),
    ]);
    const summary = buildJudgeTendencySummary(profile);
    expect(summary).toContain("smith: 2 round(s) judged across 1 tournament(s).");
    expect(summary).toContain("Side record: Aff 1-1 Neg");
    expect(summary).toContain("Avg speaker points:");
    expect(summary).toContain("Speed tolerance:");
    expect(summary).toContain("Theory receptiveness:");
  });

  it("flags unknown speed and theory data instead of fabricating a value", () => {
    const profile = buildJudgeProfile("smith", [record()]);
    const summary = buildJudgeTendencySummary(profile);
    expect(summary).toContain("Speed tolerance: unknown (no pace tracked)");
    expect(summary).toContain("Theory receptiveness: unknown (no theory raised on record)");
  });

  it("includes the most-tagged paradigm line only when one is known", () => {
    const withParadigm = buildJudgeTendencySummary(
      buildJudgeProfile("smith", [record({ paradigmId: "flow" })]),
    );
    expect(withParadigm).toContain("Most-tagged paradigm: flow (100% confidence)");

    const withoutParadigm = buildJudgeTendencySummary(buildJudgeProfile("smith", [record()]));
    expect(withoutParadigm).not.toContain("Most-tagged paradigm");
  });
});
