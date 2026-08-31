import { describe, expect, it } from "vitest";
import { isValidJudgeDecisionRecord } from "../src/state/savedJudgeDecisions";
import type { JudgeDecisionRecord } from "../src/state/judgeDecisions";

function makeRecord(overrides: Partial<JudgeDecisionRecord> = {}): JudgeDecisionRecord {
  return {
    id: "decision-1700000000000-ab12cd",
    roundId: "round-1",
    paradigmName: "Flow / Tech Judge",
    sideNames: { primary: "Affirmative", secondary: "Negative" },
    result: {
      winner: "primary",
      keyVotingIssues: ["Dropped disadvantage"],
      rationale: "The negative dropped a key disadvantage.",
    },
    generatedAt: 1700000000000,
    ...overrides,
  };
}

describe("isValidJudgeDecisionRecord", () => {
  it("accepts a well-formed record", () => {
    expect(isValidJudgeDecisionRecord(makeRecord())).toBe(true);
  });

  it("accepts a record with an empty keyVotingIssues list", () => {
    expect(isValidJudgeDecisionRecord(makeRecord({ result: { winner: "secondary", keyVotingIssues: [], rationale: "" } }))).toBe(
      true,
    );
  });

  it.each([null, undefined, "record", 42, [], true])("rejects a non-object value %p", (value) => {
    expect(isValidJudgeDecisionRecord(value)).toBe(false);
  });

  it("rejects a record with a non-string id", () => {
    expect(isValidJudgeDecisionRecord(makeRecord({ id: 5 as unknown as string }))).toBe(false);
  });

  it("rejects a record with an empty/whitespace-only id", () => {
    expect(isValidJudgeDecisionRecord(makeRecord({ id: "   " }))).toBe(false);
  });

  it("rejects a record with an empty/whitespace-only roundId", () => {
    expect(isValidJudgeDecisionRecord(makeRecord({ roundId: "" }))).toBe(false);
  });

  it("rejects a record with a non-string paradigmName", () => {
    expect(isValidJudgeDecisionRecord(makeRecord({ paradigmName: 5 as unknown as string }))).toBe(false);
  });

  it("rejects a record missing sideNames", () => {
    const record = makeRecord() as unknown as Record<string, unknown>;
    delete record.sideNames;
    expect(isValidJudgeDecisionRecord(record)).toBe(false);
  });

  it.each(["primary", "secondary"] as const)("rejects sideNames missing field %p", (field) => {
    const sideNames = { primary: "Aff", secondary: "Neg" } as Record<string, unknown>;
    delete sideNames[field];
    expect(isValidJudgeDecisionRecord(makeRecord({ sideNames: sideNames as never }))).toBe(false);
  });

  it("rejects a record missing result", () => {
    const record = makeRecord() as unknown as Record<string, unknown>;
    delete record.result;
    expect(isValidJudgeDecisionRecord(record)).toBe(false);
  });

  it("rejects a result with an invalid winner", () => {
    expect(
      isValidJudgeDecisionRecord(
        makeRecord({ result: { winner: "tie" as never, keyVotingIssues: [], rationale: "" } }),
      ),
    ).toBe(false);
  });

  it("rejects a result whose keyVotingIssues isn't an array of strings", () => {
    expect(
      isValidJudgeDecisionRecord(
        makeRecord({ result: { winner: "primary", keyVotingIssues: [5 as unknown as string], rationale: "" } }),
      ),
    ).toBe(false);
  });

  it("rejects a result with a non-string rationale", () => {
    expect(
      isValidJudgeDecisionRecord(
        makeRecord({ result: { winner: "primary", keyVotingIssues: [], rationale: 5 as unknown as string } }),
      ),
    ).toBe(false);
  });

  it("rejects a record whose generatedAt isn't a number", () => {
    expect(isValidJudgeDecisionRecord(makeRecord({ generatedAt: "yesterday" as unknown as number }))).toBe(false);
  });
});
