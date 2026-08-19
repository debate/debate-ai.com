import { describe, expect, it } from "vitest";
import { filterEditsForBox, sortEditsByTimestampDesc } from "../src/flow/edit-cells";
import type { FlowEdit } from "../src/flow/shared-flow-sync";

function edit(overrides: Partial<FlowEdit> = {}): FlowEdit {
  return {
    id: "e1",
    flowId: 1,
    boxPath: [0],
    authorId: "alice",
    content: "Emissions cause extinction",
    timestampMs: 1000,
    ...overrides,
  };
}

describe("filterEditsForBox", () => {
  it("returns only edits whose boxPath exactly matches", () => {
    const match = edit({ id: "match", boxPath: [0, 1] });
    const otherPath = edit({ id: "other-path", boxPath: [0, 2] });
    const shorterPath = edit({ id: "shorter", boxPath: [0] });

    expect(filterEditsForBox([match, otherPath, shorterPath], [0, 1])).toEqual([match]);
  });

  it("returns an empty list when nothing matches", () => {
    const other = edit({ boxPath: [1] });
    expect(filterEditsForBox([other], [0])).toEqual([]);
  });

  it("treats a boxPath prefix as distinct from the full path (no partial matches)", () => {
    const deeper = edit({ boxPath: [0, 0] });
    expect(filterEditsForBox([deeper], [0])).toEqual([]);
  });
});

describe("sortEditsByTimestampDesc", () => {
  it("sorts newest first", () => {
    const early = edit({ id: "early", timestampMs: 1000 });
    const late = edit({ id: "late", timestampMs: 9000 });
    expect(sortEditsByTimestampDesc([early, late]).map((e) => e.id)).toEqual(["late", "early"]);
  });

  it("does not mutate the input array", () => {
    const early = edit({ id: "early", timestampMs: 1000 });
    const late = edit({ id: "late", timestampMs: 9000 });
    const input = [early, late];
    sortEditsByTimestampDesc(input);
    expect(input.map((e) => e.id)).toEqual(["early", "late"]);
  });
});
