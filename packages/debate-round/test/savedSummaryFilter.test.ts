import { describe, expect, it } from "vitest";

import {
  describeSavedLoadFailure,
  filterSavedSummaries,
  SAVED_SUMMARY_SORT_OPTIONS,
  savedSummaryCountLabel,
  savedSummaryQueryTerms,
  sortSavedSummaries,
  toSavedSummarySort,
} from "../src/state/savedSummaryFilter";

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

describe("sortSavedSummaries", () => {
  const items = [
    { clientId: 1, label: "Speech 10", updatedAt: "2026-01-02T00:00:00.000Z" },
    { clientId: 2, label: "speech 2", updatedAt: "2026-01-03T00:00:00.000Z" },
    { clientId: 3, label: "Alpha", updatedAt: "2026-01-01T00:00:00.000Z" },
  ];
  const ids = (list: { clientId: number }[]) => list.map((item) => item.clientId);

  it("orders newest saved first", () => {
    expect(ids(sortSavedSummaries(items, "newest"))).toEqual([2, 1, 3]);
  });

  it("orders oldest saved first", () => {
    expect(ids(sortSavedSummaries(items, "oldest"))).toEqual([3, 1, 2]);
  });

  it("orders by name case-insensitively with numbers in natural order", () => {
    expect(ids(sortSavedSummaries(items, "name"))).toEqual([3, 2, 1]);
  });

  it("never mutates the input", () => {
    const before = ids(items);
    sortSavedSummaries(items, "name");
    expect(ids(items)).toEqual(before);
  });

  it("breaks ties by clientId and sorts an unparsable date as the oldest", () => {
    const tied = [
      { clientId: 9, label: "Same", updatedAt: ISO },
      { clientId: 4, label: "same", updatedAt: ISO },
      { clientId: 5, label: "Broken", updatedAt: "not a date" },
    ];
    expect(ids(sortSavedSummaries(tied, "newest"))).toEqual([4, 9, 5]);
    expect(ids(sortSavedSummaries(tied, "oldest"))).toEqual([5, 4, 9]);
    expect(ids(sortSavedSummaries(tied, "name"))).toEqual([5, 4, 9]);
  });

  it("handles an empty list", () => {
    expect(sortSavedSummaries([], "newest")).toEqual([]);
  });
});

describe("toSavedSummarySort", () => {
  it("keeps a known sort and falls back to newest otherwise", () => {
    expect(toSavedSummarySort("oldest")).toBe("oldest");
    expect(toSavedSummarySort("name")).toBe("name");
    expect(toSavedSummarySort("newest")).toBe("newest");
    expect(toSavedSummarySort("size")).toBe("newest");
    expect(toSavedSummarySort(undefined)).toBe("newest");
  });

  it("accepts every offered option", () => {
    for (const option of SAVED_SUMMARY_SORT_OPTIONS) expect(toSavedSummarySort(option.value)).toBe(option.value);
  });
});

describe("savedSummaryCountLabel", () => {
  it("shows the total when nothing is filtered out", () => {
    expect(savedSummaryCountLabel(3, 3)).toBe("3");
  });

  it("shows 'N of M' while a search narrows the list", () => {
    expect(savedSummaryCountLabel(1, 5)).toBe("1 of 5");
    expect(savedSummaryCountLabel(0, 2)).toBe("0 of 2");
  });
});

describe("describeSavedLoadFailure", () => {
  it("says a missing flow or round is no longer in the account", () => {
    expect(describeSavedLoadFailure("flow", "missing")).toMatch(/^This flow is no longer in your account\./);
    expect(describeSavedLoadFailure("round", "missing")).toMatch(/^This round is no longer in your account\./);
  });

  it("passes the server's own message through, trimmed", () => {
    const damaged = "This saved flow is damaged and can't be opened. You can remove it from your account.";
    expect(describeSavedLoadFailure("flow", new Error(`  ${damaged} `))).toBe(damaged);
  });

  it("falls back to a generic line for a blank Error or a non-Error", () => {
    expect(describeSavedLoadFailure("flow", new Error("   "))).toBe("Couldn't open this flow. Try again.");
    expect(describeSavedLoadFailure("round", "boom")).toBe("Couldn't open this round. Try again.");
    expect(describeSavedLoadFailure("round", undefined)).toBe("Couldn't open this round. Try again.");
  });
});
