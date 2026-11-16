import { describe, expect, it } from "vitest";

import { filterSavedSummaries, savedSummaryQueryTerms } from "../src/state/savedSummaryFilter";

const ISO = "2026-11-16T00:00:00.000Z";
const flows = [
  { clientId: 1, label: "1AC — Hegemony", updatedAt: ISO },
  { clientId: 2, label: "1NC Case Turns", updatedAt: ISO },
  { clientId: 3, label: "Speech 4", updatedAt: ISO },
];

describe("savedSummaryQueryTerms", () => {
  it("lowercases and splits on whitespace, dropping blanks", () => {
    expect(savedSummaryQueryTerms("  Case   TURNS ")).toEqual(["case", "turns"]);
    expect(savedSummaryQueryTerms("   ")).toEqual([]);
    expect(savedSummaryQueryTerms("")).toEqual([]);
  });
});

describe("filterSavedSummaries", () => {
  it("returns the same list for a blank query", () => {
    expect(filterSavedSummaries(flows, "")).toBe(flows);
    expect(filterSavedSummaries(flows, "  \t ")).toBe(flows);
  });

  it("matches the label case-insensitively", () => {
    expect(filterSavedSummaries(flows, "HEG").map((f) => f.clientId)).toEqual([1]);
  });

  it("needs every word, in any order", () => {
    expect(filterSavedSummaries(flows, "turns case").map((f) => f.clientId)).toEqual([2]);
    expect(filterSavedSummaries(flows, "case hegemony")).toEqual([]);
  });

  it("keeps the original order", () => {
    expect(filterSavedSummaries(flows, "1").map((f) => f.clientId)).toEqual([1, 2]);
  });

  it("also searches the caller's extra text for a row", () => {
    const roundNames = new Map([[3, "Glenbrooks Octafinals"]]);
    const found = filterSavedSummaries(flows, "glenbrooks", (f) => roundNames.get(f.clientId));
    expect(found.map((f) => f.clientId)).toEqual([3]);
    // A word from the label and one from the extra text together still match.
    expect(filterSavedSummaries(flows, "speech octafinals", (f) => roundNames.get(f.clientId)).map((f) => f.clientId)).toEqual([3]);
  });

  it("treats regex characters as plain text", () => {
    const odd = [{ clientId: 9, label: "K (cap) [v2]" }];
    expect(filterSavedSummaries(odd, "(cap)")).toHaveLength(1);
    expect(filterSavedSummaries(odd, ".*")).toEqual([]);
  });
});
