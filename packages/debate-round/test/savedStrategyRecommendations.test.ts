import { describe, expect, it } from "vitest";
import { isValidStrategyRecommendationRecord } from "../src/state/savedStrategyRecommendations";
import type { StrategyRecommendationRecord } from "../src/state/strategyRecommendations";

function makeRecord(overrides: Partial<StrategyRecommendationRecord> = {}): StrategyRecommendationRecord {
  return {
    id: "strategy-1700000000000-ab12cd",
    matchupId: "round-1",
    recommendation: {
      recommendedCase: { name: "Kritik case", argumentTags: ["kritik"], overlapScore: 1 },
      caseRankings: [{ name: "Kritik case", argumentTags: ["kritik"], overlapScore: 1 }],
      judgeAdaptationNotes: ["No judge tendency data on file — adapt to a generic flow judge by default."],
      riskLevel: "low",
      riskFactors: [],
    },
    generatedAt: 1700000000000,
    ...overrides,
  };
}

describe("isValidStrategyRecommendationRecord", () => {
  it("accepts a well-formed record", () => {
    expect(isValidStrategyRecommendationRecord(makeRecord())).toBe(true);
  });

  it("accepts a record with a null recommendedCase and empty rankings/notes/factors", () => {
    expect(
      isValidStrategyRecommendationRecord(
        makeRecord({
          recommendation: {
            recommendedCase: null,
            caseRankings: [],
            judgeAdaptationNotes: [],
            riskLevel: "medium",
            riskFactors: [],
          },
        }),
      ),
    ).toBe(true);
  });

  it("accepts a record with an aiCaseChoice", () => {
    expect(
      isValidStrategyRecommendationRecord(
        makeRecord({
          aiCaseChoice: {
            recommendedCase: "Kritik case",
            reasoning: "Lowest overlap and fits the judge's tendencies.",
            caseAssessments: [{ name: "Kritik case", assessment: "Safest available option." }],
          },
        }),
      ),
    ).toBe(true);
  });

  it.each([null, undefined, "record", 42, [], true])("rejects a non-object value %p", (value) => {
    expect(isValidStrategyRecommendationRecord(value)).toBe(false);
  });

  it("rejects a record with a non-string id", () => {
    expect(isValidStrategyRecommendationRecord(makeRecord({ id: 5 as unknown as string }))).toBe(false);
  });

  it("rejects a record with an empty/whitespace-only id", () => {
    expect(isValidStrategyRecommendationRecord(makeRecord({ id: "   " }))).toBe(false);
  });

  it("rejects a record with an empty/whitespace-only matchupId", () => {
    expect(isValidStrategyRecommendationRecord(makeRecord({ matchupId: "" }))).toBe(false);
  });

  it("rejects a record missing recommendation", () => {
    const record = makeRecord() as unknown as Record<string, unknown>;
    delete record.recommendation;
    expect(isValidStrategyRecommendationRecord(record)).toBe(false);
  });

  it("rejects a recommendedCase that isn't null or a valid ranked case option", () => {
    expect(
      isValidStrategyRecommendationRecord(
        makeRecord({
          recommendation: {
            recommendedCase: { name: "Kritik case" } as never,
            caseRankings: [],
            judgeAdaptationNotes: [],
            riskLevel: "low",
            riskFactors: [],
          },
        }),
      ),
    ).toBe(false);
  });

  it("rejects a caseRankings entry with a non-numeric overlapScore", () => {
    expect(
      isValidStrategyRecommendationRecord(
        makeRecord({
          recommendation: {
            recommendedCase: null,
            caseRankings: [{ name: "Kritik case", argumentTags: [], overlapScore: "high" as never }],
            judgeAdaptationNotes: [],
            riskLevel: "low",
            riskFactors: [],
          },
        }),
      ),
    ).toBe(false);
  });

  it("rejects judgeAdaptationNotes that isn't an array of strings", () => {
    expect(
      isValidStrategyRecommendationRecord(
        makeRecord({
          recommendation: {
            recommendedCase: null,
            caseRankings: [],
            judgeAdaptationNotes: [5 as unknown as string],
            riskLevel: "low",
            riskFactors: [],
          },
        }),
      ),
    ).toBe(false);
  });

  it("rejects an invalid riskLevel", () => {
    expect(
      isValidStrategyRecommendationRecord(
        makeRecord({
          recommendation: {
            recommendedCase: null,
            caseRankings: [],
            judgeAdaptationNotes: [],
            riskLevel: "extreme" as never,
            riskFactors: [],
          },
        }),
      ),
    ).toBe(false);
  });

  it("rejects an aiCaseChoice missing a required field", () => {
    expect(
      isValidStrategyRecommendationRecord(
        makeRecord({ aiCaseChoice: { recommendedCase: "Kritik case", caseAssessments: [] } as never }),
      ),
    ).toBe(false);
  });

  it("rejects an aiCaseChoice with a malformed caseAssessments entry", () => {
    expect(
      isValidStrategyRecommendationRecord(
        makeRecord({
          aiCaseChoice: {
            recommendedCase: "Kritik case",
            reasoning: "Reasoning.",
            caseAssessments: [{ name: "Kritik case" } as never],
          },
        }),
      ),
    ).toBe(false);
  });

  it("rejects a record whose generatedAt isn't a number", () => {
    expect(isValidStrategyRecommendationRecord(makeRecord({ generatedAt: "yesterday" as unknown as number }))).toBe(
      false,
    );
  });
});
