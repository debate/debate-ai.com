/**
 * @fileoverview A win/loss alone counts as a decision, and the revealed
 * decision reads as who won plus the ballot count.
 */

import { describe, expect, it } from "vitest";
import { ballotCount, decisionSummary, hasDecision } from "../src/lib/decision-summary";

describe("hasDecision", () => {
  it("is true for a recorded winner even without decision text", () => {
    expect(hasDecision(true, null)).toBe(true);
    expect(hasDecision(false, undefined)).toBe(true);
    expect(hasDecision(null, "2-1")).toBe(true);
  });

  it("is false with neither a winner nor text", () => {
    expect(hasDecision(null, null)).toBe(false);
    expect(hasDecision(undefined, "  ")).toBe(false);
  });
});

describe("decisionSummary", () => {
  it("names the winner and the ballots, dropping a repeated side", () => {
    expect(decisionSummary(true, "3-0 Aff")).toBe("Aff won 3-0");
    expect(decisionSummary(false, "Neg 2–1")).toBe("Neg won 2-1");
  });

  it("names just the winner for a win/loss with no ballots", () => {
    expect(decisionSummary(false, null)).toBe("Neg won");
    expect(decisionSummary(true, "W", { aff: "Harker LL (Aff)" })).toBe("Harker LL (Aff) won");
  });

  it("falls back to the stored text without a recorded winner", () => {
    expect(decisionSummary(null, "2-1")).toBe("2-1");
    expect(decisionSummary(null, null)).toBeNull();
  });

  it("reads the ballot count", () => {
    expect(ballotCount("Aff on a 2-1")).toBe("2-1");
    expect(ballotCount("Aff")).toBeNull();
  });
});
