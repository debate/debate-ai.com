/**
 * @fileoverview Pins what a viewer's change request may carry. Anyone signed
 * in can file one, so the server keeps only the fields a viewer may propose,
 * in the shapes the library PATCH accepts — a request can never set the
 * top-pick flag, invent a lecture shelf, or smuggle in an unknown column.
 */
import { describe, expect, it } from "vitest";
import { parseStoredChanges, sanitizeProposedChanges } from "../video-change-requests";

describe("sanitizeProposedChanges", () => {
  it("keeps suggestable fields and drops staff-only ones", () => {
    expect(
      sanitizeProposedChanges({
        title: "Fixed title",
        tournament: null,
        isTopPick: true,
        viewCount: 1_000_000,
        source: "round",
        bogus: "x",
      }),
    ).toEqual({ title: "Fixed title", tournament: null });
  });

  it("accepts only classifier categories", () => {
    expect(sanitizeProposedChanges({ category: "Topic Lectures" })).toEqual({ category: "Topic Lectures" });
    expect(sanitizeProposedChanges({ category: "My New Shelf" })).toEqual({});
    expect(sanitizeProposedChanges({ category: "" })).toEqual({ category: null });
  });

  it("accepts only known styles and boolean winners", () => {
    expect(sanitizeProposedChanges({ style: 2, affWin: false })).toEqual({ style: 2, affWin: false });
    expect(sanitizeProposedChanges({ style: 9, affWin: "yes" })).toEqual({});
    expect(sanitizeProposedChanges({ style: null })).toEqual({ style: null });
  });

  it("ignores non-object input", () => {
    expect(sanitizeProposedChanges(null)).toEqual({});
    expect(sanitizeProposedChanges(["title"])).toEqual({});
  });
});

describe("parseStoredChanges", () => {
  it("round-trips a stored edit request", () => {
    const stored = JSON.stringify({ changes: { roundLevel: "Finals" }, reason: "typo" });
    expect(parseStoredChanges(stored)).toEqual({ roundLevel: "Finals" });
  });

  it("reads plain report text as no request", () => {
    expect(parseStoredChanges("the video does not play")).toBeNull();
  });
});
