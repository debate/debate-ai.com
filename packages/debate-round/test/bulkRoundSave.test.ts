import { describe, expect, it } from "vitest";
import { collectFlowsForRounds, summarizeBulkRoundSave } from "../src/state/bulkRoundSave";
import type { Box, Flow, Round } from "../src/types/flow";

function makeBox(overrides: Partial<Box> = {}): Box {
  return { content: "", children: [], index: 0, level: 0, focus: false, ...overrides };
}

function makeFlow(overrides: Partial<Flow> = {}): Flow {
  return {
    content: "1AC",
    level: 0,
    columns: ["1AC", "1NC"],
    invert: false,
    focus: false,
    index: 0,
    lastFocus: [0],
    children: [makeBox()],
    id: 1,
    ...overrides,
  };
}

function makeRound(overrides: Partial<Round> = {}): Round {
  return {
    id: 100,
    tournamentName: "Glenbrooks",
    roundLevel: "Octafinals",
    debaters: { aff: ["a@b.com", ""], neg: ["c@d.com", ""] },
    judges: ["judge@e.com"],
    flowIds: [],
    timestamp: 1700000000000,
    status: "completed",
    ...overrides,
  };
}

describe("collectFlowsForRounds", () => {
  it("returns an empty list when there are no rounds", () => {
    expect(collectFlowsForRounds([], [makeFlow({ id: 1 })])).toEqual([]);
  });

  it("returns an empty list when no round has any flows", () => {
    expect(collectFlowsForRounds([makeRound({ flowIds: [] })], [makeFlow({ id: 1 })])).toEqual([]);
  });

  it("collects every flow a single round references", () => {
    const flow1 = makeFlow({ id: 1 });
    const flow2 = makeFlow({ id: 2 });
    const round = makeRound({ flowIds: [1, 2] });
    expect(collectFlowsForRounds([round], [flow1, flow2])).toEqual([flow1, flow2]);
  });

  it("deduplicates a flow shared by multiple rounds, keeping the first-referencing round's order", () => {
    const flow1 = makeFlow({ id: 1 });
    const flow2 = makeFlow({ id: 2 });
    const flow3 = makeFlow({ id: 3 });
    const roundA = makeRound({ id: 100, flowIds: [1, 2] });
    const roundB = makeRound({ id: 101, flowIds: [2, 3] });
    expect(collectFlowsForRounds([roundA, roundB], [flow1, flow2, flow3])).toEqual([flow1, flow2, flow3]);
  });

  it("deduplicates a flow id listed twice within the same round", () => {
    const flow1 = makeFlow({ id: 1 });
    const round = makeRound({ flowIds: [1, 1] });
    expect(collectFlowsForRounds([round], [flow1])).toEqual([flow1]);
  });

  it("skips a flowId with no matching local flow", () => {
    const flow1 = makeFlow({ id: 1 });
    const round = makeRound({ flowIds: [1, 999] });
    expect(collectFlowsForRounds([round], [flow1])).toEqual([flow1]);
  });

  it("skips rounds entirely when none of their flows are locally available", () => {
    const round = makeRound({ flowIds: [42] });
    expect(collectFlowsForRounds([round], [])).toEqual([]);
  });
});

describe("summarizeBulkRoundSave", () => {
  it("returns zero counts for an empty outcomes map", () => {
    expect(summarizeBulkRoundSave({})).toEqual({ savedCount: 0, errorCount: 0 });
  });

  it("counts saved and error outcomes separately", () => {
    expect(summarizeBulkRoundSave({ 1: "saved", 2: "saved", 3: "error" })).toEqual({
      savedCount: 2,
      errorCount: 1,
    });
  });

  it("counts an all-saved outcome map", () => {
    expect(summarizeBulkRoundSave({ 1: "saved", 2: "saved" })).toEqual({ savedCount: 2, errorCount: 0 });
  });

  it("counts an all-error outcome map", () => {
    expect(summarizeBulkRoundSave({ 1: "error", 2: "error" })).toEqual({ savedCount: 0, errorCount: 2 });
  });
});
