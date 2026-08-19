import { describe, expect, it } from "vitest";
import { sortEditsNewestFirst } from "../src/flow/edit-cells";
import type { FlowEdit } from "../src/flow/shared-flow-sync";

function edit(overrides: Partial<FlowEdit> = {}): FlowEdit {
  return {
    id: "edit-1",
    flowId: 1,
    boxPath: [0],
    authorId: "alice",
    content: "Emissions cause extinction",
    timestampMs: 1000,
    ...overrides,
  };
}

describe("sortEditsNewestFirst", () => {
  it("returns an empty list unchanged", () => {
    expect(sortEditsNewestFirst([])).toEqual([]);
  });

  it("orders edits newest timestamp first, regardless of input order", () => {
    const early = edit({ id: "early", timestampMs: 1000 });
    const late = edit({ id: "late", timestampMs: 9000 });
    expect(sortEditsNewestFirst([early, late])).toEqual([late, early]);
    expect(sortEditsNewestFirst([late, early])).toEqual([late, early]);
  });

  it("does not mutate the input array", () => {
    const early = edit({ id: "early", timestampMs: 1000 });
    const late = edit({ id: "late", timestampMs: 9000 });
    const input = [early, late];
    sortEditsNewestFirst(input);
    expect(input).toEqual([early, late]);
  });
});
