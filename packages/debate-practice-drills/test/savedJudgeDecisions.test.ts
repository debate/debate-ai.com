import { describe, expect, it } from "vitest";
import {
  isValidJudgeDecisionRecord,
  judgeDecisionIdsOverCap,
  MAX_JUDGE_DECISIONS_PER_ROUND,
} from "../src/state/savedJudgeDecisions";
import { MAX_JUDGE_DECISIONS_PER_ROUND as REEXPORTED_CAP } from "../src/state/judgeDecisions";
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

describe("judgeDecisionIdsOverCap", () => {
  const entry = (id: string, generatedAt: number, roundId = "round-1") => ({ id, roundId, generatedAt });

  it("keeps the device and account cap the same constant", () => {
    expect(MAX_JUDGE_DECISIONS_PER_ROUND).toBe(20);
    expect(REEXPORTED_CAP).toBe(MAX_JUDGE_DECISIONS_PER_ROUND);
  });

  it("returns nothing while every round is at or under the cap", () => {
    const records = Array.from({ length: MAX_JUDGE_DECISIONS_PER_ROUND }, (_, i) => entry(`d${i}`, i));
    expect(judgeDecisionIdsOverCap(records)).toEqual([]);
    expect(judgeDecisionIdsOverCap([])).toEqual([]);
  });

  it("returns the oldest decisions beyond the cap, oldest first", () => {
    const records = Array.from({ length: 23 }, (_, i) => entry(`d${String(i).padStart(2, "0")}`, 1000 + i));
    expect(judgeDecisionIdsOverCap(records)).toEqual(["d00", "d01", "d02"]);
  });

  it("caps each round on its own, in first-seen round order", () => {
    const records = [
      entry("b-old", 1, "round-b"),
      entry("b-new", 2, "round-b"),
      entry("a-old", 1, "round-a"),
      entry("a-mid", 2, "round-a"),
      entry("a-new", 3, "round-a"),
    ];
    expect(judgeDecisionIdsOverCap(records, 1)).toEqual(["b-old", "a-old", "a-mid"]);
  });

  it("breaks a generatedAt tie by keeping the smaller id, whatever the input order", () => {
    const tied = [entry("z", 5), entry("a", 5), entry("m", 5)];
    expect(judgeDecisionIdsOverCap(tied, 2)).toEqual(["z"]);
    expect(judgeDecisionIdsOverCap([...tied].reverse(), 2)).toEqual(["z"]);
  });

  it("trims a round whole with a cap of 0 and treats a negative cap as 0", () => {
    expect(judgeDecisionIdsOverCap([entry("a", 1), entry("b", 2)], 0)).toEqual(["a", "b"]);
    expect(judgeDecisionIdsOverCap([entry("a", 1)], -3)).toEqual(["a"]);
  });

  it("never mutates its input", () => {
    const records = [entry("new", 2), entry("old", 1)];
    const copy = records.map((record) => ({ ...record }));
    judgeDecisionIdsOverCap(records, 1);
    expect(records).toEqual(copy);
  });
});
