import { describe, expect, it } from "vitest";
import {
  boxPathForCell,
  columnIndexFromField,
  pickJumpAnnotation,
} from "../src/flow/annotation-cells";
import type { FlowAnnotation } from "../src/flow/flow-annotations";

function annotation(overrides: Partial<FlowAnnotation> = {}): FlowAnnotation {
  return {
    id: "a1",
    flowId: 1,
    boxPath: [0],
    speechId: "1AC",
    timestampMs: 1000,
    createdAt: 0,
    ...overrides,
  };
}

describe("boxPathForCell", () => {
  it("is just the row index for the first column", () => {
    expect(boxPathForCell(0, 0)).toEqual([0]);
    expect(boxPathForCell(7, 0)).toEqual([7]);
  });

  it("appends one zero per column index, matching the children[0] chain FlowSpreadsheet flattens", () => {
    expect(boxPathForCell(3, 1)).toEqual([3, 0]);
    expect(boxPathForCell(3, 4)).toEqual([3, 0, 0, 0, 0]);
  });

  it("clamps a negative column index to the first column's path", () => {
    expect(boxPathForCell(2, -1)).toEqual([2]);
  });
});

describe("columnIndexFromField", () => {
  it("parses the numeric suffix of an AG Grid col_N field", () => {
    expect(columnIndexFromField("col_0")).toBe(0);
    expect(columnIndexFromField("col_12")).toBe(12);
  });

  it("falls back to 0 for an unrecognized or missing field", () => {
    expect(columnIndexFromField("something-else")).toBe(0);
    expect(columnIndexFromField(undefined)).toBe(0);
  });
});

describe("pickJumpAnnotation", () => {
  it("returns null for an empty list", () => {
    expect(pickJumpAnnotation([])).toBeNull();
  });

  it("picks the single annotation when there's only one", () => {
    const a = annotation({ timestampMs: 5000 });
    expect(pickJumpAnnotation([a])).toBe(a);
  });

  it("picks the earliest annotation by timestamp when there are several, regardless of input order", () => {
    const early = annotation({ id: "early", timestampMs: 1000 });
    const late = annotation({ id: "late", timestampMs: 9000 });
    expect(pickJumpAnnotation([late, early])).toBe(early);
  });

  it("does not mutate the input array", () => {
    const early = annotation({ id: "early", timestampMs: 1000 });
    const late = annotation({ id: "late", timestampMs: 9000 });
    const input = [late, early];
    pickJumpAnnotation(input);
    expect(input).toEqual([late, early]);
  });
});
