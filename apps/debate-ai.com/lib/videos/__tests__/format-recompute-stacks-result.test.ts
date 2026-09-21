import { describe, expect, it } from "vitest";
import { formatRecomputeStacksResult } from "../format-recompute-stacks-result";

describe("formatRecomputeStacksResult", () => {
  it("reports no changes when nothing moved", () => {
    expect(formatRecomputeStacksResult({ rows: 812, updated: 0 })).toBe(
      "No changes — checked 812 videos.",
    );
  });

  it("reports how many of the checked rows were updated", () => {
    expect(formatRecomputeStacksResult({ rows: 812, updated: 6 })).toBe(
      "Updated 6 of 812 videos.",
    );
  });

  it("reports every row updated", () => {
    expect(formatRecomputeStacksResult({ rows: 10, updated: 10 })).toBe(
      "Updated 10 of 10 videos.",
    );
  });

  it("formats large counts with thousands separators", () => {
    expect(formatRecomputeStacksResult({ rows: 12000, updated: 1500 })).toBe(
      "Updated 1,500 of 12,000 videos.",
    );
  });

  it("handles an empty table", () => {
    expect(formatRecomputeStacksResult({ rows: 0, updated: 0 })).toBe(
      "No changes — checked 0 videos.",
    );
  });
});
