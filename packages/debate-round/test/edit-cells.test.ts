import { describe, expect, it } from "vitest";
import { gridCellForBoxPath, sortEditsNewestFirst } from "../src/flow/edit-cells";
import { boxPathForCell } from "../src/flow/annotation-cells";
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

describe("gridCellForBoxPath", () => {
  it("maps the first column of the first row to row-0/col_0", () => {
    expect(gridCellForBoxPath([0])).toEqual({ rowId: "row-0", field: "col_0" });
  });

  it("maps a later row/column to the matching row-N/col_N pair", () => {
    expect(gridCellForBoxPath([4, 0, 0])).toEqual({ rowId: "row-4", field: "col_2" });
  });

  it("round-trips through boxPathForCell for arbitrary row/column indices", () => {
    expect(gridCellForBoxPath(boxPathForCell(7, 3))).toEqual({ rowId: "row-7", field: "col_3" });
    expect(gridCellForBoxPath(boxPathForCell(0, 0))).toEqual({ rowId: "row-0", field: "col_0" });
  });
});
