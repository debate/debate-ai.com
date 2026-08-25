import { describe, expect, it, vi } from "vitest";
import {
  buildBoxJumpFailedMessage,
  gridCellForBoxPath,
  hasExhaustedBoxJumpAttempts,
  jumpToBoxInGrid,
  MAX_BOX_JUMP_ATTEMPTS,
  sortEditsNewestFirst,
  type GridJumpApi,
} from "../src/flow/edit-cells";
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

describe("jumpToBoxInGrid", () => {
  function fakeApi(rowNode: unknown): GridJumpApi {
    return {
      getRowNode: vi.fn().mockReturnValue(rowNode),
      ensureNodeVisible: vi.fn(),
      flashCells: vi.fn(),
    };
  }

  it("scrolls to and flashes the box's cell, and reports success", () => {
    const rowNode = { id: "row-4" };
    const api = fakeApi(rowNode);

    expect(jumpToBoxInGrid(api, [4, 0, 0])).toBe(true);

    expect(api.getRowNode).toHaveBeenCalledWith("row-4");
    expect(api.ensureNodeVisible).toHaveBeenCalledWith(rowNode);
    expect(api.flashCells).toHaveBeenCalledWith({ rowNodes: [rowNode], columns: ["col_2"] });
  });

  it("is a no-op and reports failure when the row isn't in the grid's row model yet", () => {
    const api = fakeApi(null);

    expect(jumpToBoxInGrid(api, [0])).toBe(false);

    expect(api.ensureNodeVisible).not.toHaveBeenCalled();
    expect(api.flashCells).not.toHaveBeenCalled();
  });
});

describe("hasExhaustedBoxJumpAttempts", () => {
  it("is false for every attempt count below the retry budget", () => {
    for (let attempts = 0; attempts < MAX_BOX_JUMP_ATTEMPTS; attempts++) {
      expect(hasExhaustedBoxJumpAttempts(attempts)).toBe(false);
    }
  });

  it("is true once attempts reaches the retry budget", () => {
    expect(hasExhaustedBoxJumpAttempts(MAX_BOX_JUMP_ATTEMPTS)).toBe(true);
  });

  it("stays true beyond the retry budget", () => {
    expect(hasExhaustedBoxJumpAttempts(MAX_BOX_JUMP_ATTEMPTS + 10)).toBe(true);
  });
});

describe("buildBoxJumpFailedMessage", () => {
  it("returns a non-empty, user-facing message", () => {
    const message = buildBoxJumpFailedMessage();
    expect(typeof message).toBe("string");
    expect(message.length).toBeGreaterThan(0);
  });
});
