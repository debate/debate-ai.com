import { describe, expect, it } from "vitest";
import {
  collectFlowsForRounds,
  collectUnreferencedFlows,
  filterDirtyFlows,
  filterDirtyRounds,
  hashFlowContent,
  hashRoundContent,
  mapFlowsToReferencingRound,
  summarizeBulkSaveOutcomes,
} from "../src/state/bulkRoundSave";
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

describe("collectUnreferencedFlows", () => {
  it("returns every flow when there are no rounds", () => {
    const flow1 = makeFlow({ id: 1 });
    const flow2 = makeFlow({ id: 2 });
    expect(collectUnreferencedFlows([], [flow1, flow2])).toEqual([flow1, flow2]);
  });

  it("returns an empty list when there are no local flows", () => {
    expect(collectUnreferencedFlows([makeRound({ flowIds: [1] })], [])).toEqual([]);
  });

  it("excludes a flow referenced by a round", () => {
    const flow1 = makeFlow({ id: 1 });
    const flow2 = makeFlow({ id: 2 });
    const round = makeRound({ flowIds: [1] });
    expect(collectUnreferencedFlows([round], [flow1, flow2])).toEqual([flow2]);
  });

  it("excludes a flow referenced by any of several rounds", () => {
    const flow1 = makeFlow({ id: 1 });
    const flow2 = makeFlow({ id: 2 });
    const flow3 = makeFlow({ id: 3 });
    const roundA = makeRound({ id: 100, flowIds: [1] });
    const roundB = makeRound({ id: 101, flowIds: [3] });
    expect(collectUnreferencedFlows([roundA, roundB], [flow1, flow2, flow3])).toEqual([flow2]);
  });

  it("returns an empty list when every local flow is referenced by some round", () => {
    const flow1 = makeFlow({ id: 1 });
    const flow2 = makeFlow({ id: 2 });
    const round = makeRound({ flowIds: [1, 2] });
    expect(collectUnreferencedFlows([round], [flow1, flow2])).toEqual([]);
  });

  it("preserves the flows list's own order", () => {
    const flow1 = makeFlow({ id: 1 });
    const flow2 = makeFlow({ id: 2 });
    const flow3 = makeFlow({ id: 3 });
    const round = makeRound({ flowIds: [2] });
    expect(collectUnreferencedFlows([round], [flow3, flow1, flow2])).toEqual([flow3, flow1]);
  });

  it("is unaffected by a round referencing a flowId with no matching local flow", () => {
    const flow1 = makeFlow({ id: 1 });
    const round = makeRound({ flowIds: [999] });
    expect(collectUnreferencedFlows([round], [flow1])).toEqual([flow1]);
  });
});

describe("mapFlowsToReferencingRound", () => {
  it("returns an empty map when there are no rounds", () => {
    expect(mapFlowsToReferencingRound([]).size).toBe(0);
  });

  it("returns an empty map when no round references any flow", () => {
    expect(mapFlowsToReferencingRound([makeRound({ flowIds: [] })]).size).toBe(0);
  });

  it("maps a single round's flow ids to that round", () => {
    const round = makeRound({ id: 100, flowIds: [1, 2] });
    const result = mapFlowsToReferencingRound([round]);
    expect(result.get(1)).toBe(round);
    expect(result.get(2)).toBe(round);
  });

  it("attributes a flow shared by multiple rounds to the first-referencing round", () => {
    const roundA = makeRound({ id: 100, flowIds: [1, 2] });
    const roundB = makeRound({ id: 101, flowIds: [2, 3] });
    const result = mapFlowsToReferencingRound([roundA, roundB]);
    expect(result.get(1)).toBe(roundA);
    expect(result.get(2)).toBe(roundA);
    expect(result.get(3)).toBe(roundB);
  });

  it("does not include a flow id no round references", () => {
    const round = makeRound({ flowIds: [1] });
    const result = mapFlowsToReferencingRound([round]);
    expect(result.has(2)).toBe(false);
  });
});

describe("hashFlowContent", () => {
  it("returns the same hash for two structurally identical flows", () => {
    expect(hashFlowContent(makeFlow({ id: 1 }))).toBe(hashFlowContent(makeFlow({ id: 1 })));
  });

  it("returns a different hash when flow content changes", () => {
    const original = makeFlow({ content: "1AC" });
    const edited = makeFlow({ content: "1AC (edited)" });
    expect(hashFlowContent(original)).not.toBe(hashFlowContent(edited));
  });

  it("returns a different hash when a nested box changes", () => {
    const original = makeFlow({ children: [makeBox({ content: "original" })] });
    const edited = makeFlow({ children: [makeBox({ content: "edited" })] });
    expect(hashFlowContent(original)).not.toBe(hashFlowContent(edited));
  });
});

describe("hashRoundContent", () => {
  it("returns the same hash for two structurally identical rounds", () => {
    expect(hashRoundContent(makeRound({ id: 100 }))).toBe(hashRoundContent(makeRound({ id: 100 })));
  });

  it("returns a different hash when round content changes", () => {
    const original = makeRound({ tournamentName: "Glenbrooks" });
    const edited = makeRound({ tournamentName: "Blake" });
    expect(hashRoundContent(original)).not.toBe(hashRoundContent(edited));
  });
});

describe("filterDirtyFlows", () => {
  it("treats every flow as dirty when the hash map is empty (never saved this session)", () => {
    const flow1 = makeFlow({ id: 1 });
    const flow2 = makeFlow({ id: 2 });
    expect(filterDirtyFlows([flow1, flow2], {})).toEqual([flow1, flow2]);
  });

  it("excludes a flow whose current content hash matches its last-saved hash", () => {
    const flow = makeFlow({ id: 1 });
    const lastSavedHashes = { 1: hashFlowContent(flow) };
    expect(filterDirtyFlows([flow], lastSavedHashes)).toEqual([]);
  });

  it("includes a flow whose content changed since it was last saved", () => {
    const savedVersion = makeFlow({ id: 1, content: "1AC" });
    const lastSavedHashes = { 1: hashFlowContent(savedVersion) };
    const editedVersion = makeFlow({ id: 1, content: "1AC (edited)" });
    expect(filterDirtyFlows([editedVersion], lastSavedHashes)).toEqual([editedVersion]);
  });

  it("only skips the unchanged flow out of a mixed list", () => {
    const clean = makeFlow({ id: 1, content: "clean" });
    const dirty = makeFlow({ id: 2, content: "dirty" });
    const lastSavedHashes = { 1: hashFlowContent(clean), 2: hashFlowContent(makeFlow({ id: 2, content: "old" })) };
    expect(filterDirtyFlows([clean, dirty], lastSavedHashes)).toEqual([dirty]);
  });
});

describe("filterDirtyRounds", () => {
  it("treats every round as dirty when the hash map is empty (never saved this session)", () => {
    const round1 = makeRound({ id: 100 });
    const round2 = makeRound({ id: 101 });
    expect(filterDirtyRounds([round1, round2], {})).toEqual([round1, round2]);
  });

  it("excludes a round whose current content hash matches its last-saved hash", () => {
    const round = makeRound({ id: 100 });
    const lastSavedHashes = { 100: hashRoundContent(round) };
    expect(filterDirtyRounds([round], lastSavedHashes)).toEqual([]);
  });

  it("includes a round whose content changed since it was last saved", () => {
    const savedVersion = makeRound({ id: 100, tournamentName: "Glenbrooks" });
    const lastSavedHashes = { 100: hashRoundContent(savedVersion) };
    const editedVersion = makeRound({ id: 100, tournamentName: "Blake" });
    expect(filterDirtyRounds([editedVersion], lastSavedHashes)).toEqual([editedVersion]);
  });
});

describe("summarizeBulkSaveOutcomes", () => {
  it("returns zero counts for an empty outcomes map", () => {
    expect(summarizeBulkSaveOutcomes({})).toEqual({ savedCount: 0, errorCount: 0 });
  });

  it("counts saved and error outcomes separately", () => {
    expect(summarizeBulkSaveOutcomes({ 1: "saved", 2: "saved", 3: "error" })).toEqual({
      savedCount: 2,
      errorCount: 1,
    });
  });

  it("counts an all-saved outcome map", () => {
    expect(summarizeBulkSaveOutcomes({ 1: "saved", 2: "saved" })).toEqual({ savedCount: 2, errorCount: 0 });
  });

  it("counts an all-error outcome map", () => {
    expect(summarizeBulkSaveOutcomes({ 1: "error", 2: "error" })).toEqual({ savedCount: 0, errorCount: 2 });
  });
});
