import { describe, expect, it } from "vitest";
import {
  DEFAULT_RESEARCH_PROGRESS_GOAL_SYNC,
  isValidResearchProgressGoalSyncPayload,
  MAX_GOAL_TARGET_COMPLETED_TASK_COUNT,
  normalizeResearchProgressGoalPatch,
  parseResearchProgressGoal,
  serializeResearchProgressGoal,
} from "../src/lib/research-progress-goal-sync";

describe("DEFAULT_RESEARCH_PROGRESS_GOAL_SYNC", () => {
  it("defaults to no goal", () => {
    expect(DEFAULT_RESEARCH_PROGRESS_GOAL_SYNC).toEqual({ researchProgressGoal: null });
  });
});

describe("isValidResearchProgressGoalSyncPayload", () => {
  it("accepts a target-only goal", () => {
    expect(isValidResearchProgressGoalSyncPayload({ targetCompletedTaskCount: 5 })).toBe(true);
  });

  it("accepts a goal with topic and targetDate", () => {
    expect(
      isValidResearchProgressGoalSyncPayload({
        targetCompletedTaskCount: 5,
        topic: "Immigration",
        targetDate: "2026-06-01",
      }),
    ).toBe(true);
  });

  it("accepts a target exactly at the max", () => {
    expect(isValidResearchProgressGoalSyncPayload({ targetCompletedTaskCount: MAX_GOAL_TARGET_COMPLETED_TASK_COUNT })).toBe(
      true,
    );
  });

  it("rejects a target exceeding the max", () => {
    expect(
      isValidResearchProgressGoalSyncPayload({ targetCompletedTaskCount: MAX_GOAL_TARGET_COMPLETED_TASK_COUNT + 1 }),
    ).toBe(false);
  });

  it("rejects a zero or negative target", () => {
    expect(isValidResearchProgressGoalSyncPayload({ targetCompletedTaskCount: 0 })).toBe(false);
    expect(isValidResearchProgressGoalSyncPayload({ targetCompletedTaskCount: -3 })).toBe(false);
  });

  it("rejects a non-integer target", () => {
    expect(isValidResearchProgressGoalSyncPayload({ targetCompletedTaskCount: 2.5 })).toBe(false);
  });

  it("rejects a missing target", () => {
    expect(isValidResearchProgressGoalSyncPayload({ topic: "Immigration" })).toBe(false);
  });

  it("rejects a blank topic", () => {
    expect(isValidResearchProgressGoalSyncPayload({ targetCompletedTaskCount: 5, topic: "   " })).toBe(false);
  });

  it("rejects an unrecognized field, e.g. a smuggled contributorId", () => {
    expect(
      isValidResearchProgressGoalSyncPayload({ targetCompletedTaskCount: 5, contributorId: "someone-else" }),
    ).toBe(false);
  });

  it("rejects non-object values", () => {
    expect(isValidResearchProgressGoalSyncPayload(null)).toBe(false);
    expect(isValidResearchProgressGoalSyncPayload("goal")).toBe(false);
    expect(isValidResearchProgressGoalSyncPayload([{ targetCompletedTaskCount: 5 }])).toBe(false);
  });
});

describe("normalizeResearchProgressGoalPatch", () => {
  it("accepts null as a clear instruction", () => {
    const result = normalizeResearchProgressGoalPatch({ researchProgressGoal: null });
    expect(result.errors).toEqual([]);
    expect(result.valid).toEqual({ researchProgressGoal: null });
  });

  it("accepts a well-formed goal", () => {
    const goal = { targetCompletedTaskCount: 8, topic: "Immigration" };
    const result = normalizeResearchProgressGoalPatch({ researchProgressGoal: goal });
    expect(result.errors).toEqual([]);
    expect(result.valid).toEqual({ researchProgressGoal: goal });
  });

  it("rejects a malformed goal with an error message and leaves valid empty", () => {
    const result = normalizeResearchProgressGoalPatch({ researchProgressGoal: { targetCompletedTaskCount: -1 } });
    expect(result.errors).toHaveLength(1);
    expect(result.valid).toEqual({});
  });

  it("omits the field entirely when absent from the input", () => {
    const result = normalizeResearchProgressGoalPatch({ debateStyle: 1 });
    expect(result.errors).toEqual([]);
    expect(result.valid).toEqual({});
  });

  it("rejects a non-object request body", () => {
    const result = normalizeResearchProgressGoalPatch("not an object");
    expect(result.errors).toHaveLength(1);
    expect(result.valid).toEqual({});
  });
});

describe("serializeResearchProgressGoal / parseResearchProgressGoal", () => {
  it("round-trips a goal", () => {
    const goal = { targetCompletedTaskCount: 8, topic: "Immigration", targetDate: "2026-06-01" };
    expect(parseResearchProgressGoal(serializeResearchProgressGoal(goal))).toEqual(goal);
  });

  it("serializes null to null and parses null/empty back to null", () => {
    expect(serializeResearchProgressGoal(null)).toBeNull();
    expect(parseResearchProgressGoal(null)).toBeNull();
    expect(parseResearchProgressGoal(undefined)).toBeNull();
    expect(parseResearchProgressGoal("")).toBeNull();
  });

  it("parses corrupt JSON back to null rather than throwing", () => {
    expect(parseResearchProgressGoal("{not json")).toBeNull();
  });

  it("parses a stored value that fails validation back to null", () => {
    expect(parseResearchProgressGoal(JSON.stringify({ targetCompletedTaskCount: -1 }))).toBeNull();
  });
});
