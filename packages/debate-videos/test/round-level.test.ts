import { describe, expect, it } from "vitest";
import {
  formatRoundLevel,
  getRoundSortKey,
  parseRoundLevel,
  standardizeRoundLevel,
} from "../src/components/video-card/round-level";

describe("standardizeRoundLevel", () => {
  it.each([
    ["R1", "R1"],
    ["R6", "R6"],
    ["r 08", "R8"],
    ["RD 7", "R7"],
    ["Round 1", "R1"],
    ["Round #02", "R2"],
    ["Round 7th", "R7"],
    ["Open Round 8", "R8"],
    ["Prelim Round 4", "R4"],
    ["Preliminary Round 5", "R5"],
    ["Elim Round 3", "R3"],

    ["Round First", "R1"],
    ["Round the First", "R1"],
    ["Round Second", "R2"],
    ["Round Fourth", "R4"],
    ["Round Fifth", "R5"],
    ["Round Sixth", "R6"],
    ["Round Seventh", "R7"],
    ["Round Eighth", "R8"],

    ["R IV", "R4"],
    ["Round VI", "R6"],
    ["Open Round VIII", "R8"],

    ["3", "R3"],
    ["06", "R6"],

    ["Triples", "TRIPLES"],
    ["Triple Octos", "TRIPLES"],
    ["Triple Octofinals", "TRIPLES"],

    ["Doubles", "DOUBLES"],
    ["Double Octos", "DOUBLES"],
    ["Double Octofinals", "DOUBLES"],

    ["Octos", "OCTOS"],
    ["Octas", "OCTOS"],
    ["Octofinals", "OCTOS"],
    ["Octo Finals", "OCTOS"],
    ["Octa-Finals", "OCTOS"],

    ["Quarters", "QUARTERS"],
    ["Quarterfinals", "QUARTERS"],
    ["Quarter Finals", "QUARTERS"],
    ["QF", "QUARTERS"],

    ["Semis", "SEMIS"],
    ["Semi-Finals", "SEMIS"],
    ["Semifinals", "SEMIS"],
    ["SF", "SEMIS"],

    ["Final", "FINALS"],
    ["Finals", "FINALS"],
    ["Grand Finals", "FINALS"],
    ["Championship", "FINALS"],
    ["Championship Round", "FINALS"],
    ["Final Round - Wake Forest(A)", "FINALS"],
    ["ACC Debate Tournament Final Round - Notre Dame (A)", "FINALS"],
    ["NDT 2018 Round Finals", "FINALS"],

    ["Runoff", "RUNOFFS"],
    ["Runoffs", "RUNOFFS"],
    ["TOC 2025 Runoffs", "RUNOFFS"],
  ] as const)('parses "%s" as %s', (input, expected) => {
    expect(standardizeRoundLevel(input)).toBe(expected);
  });

  it("does not classify incomplete/truncated labels", () => {
    expect(standardizeRoundLevel("Open Ro")).toBe("UNKNOWN");
    expect(standardizeRoundLevel("Round")).toBe("UNKNOWN");
    expect(standardizeRoundLevel("Semi")).toBe("UNKNOWN");
    expect(standardizeRoundLevel("Finalist")).toBe("UNKNOWN");
  });

  it("marks bare numeric labels as inferred", () => {
    expect(parseRoundLevel("3")).toEqual({
      raw: "3",
      normalized: "3",
      level: "R3",
      confidence: "inferred",
    });
  });

  it("formats canonical levels for display", () => {
    expect(formatRoundLevel("R6")).toBe("Round 6");
    expect(formatRoundLevel("DOUBLES")).toBe("Double Octofinals");
    expect(formatRoundLevel("OCTOS")).toBe("Octofinals");
    expect(formatRoundLevel("QUARTERS")).toBe("Quarterfinals");
    expect(formatRoundLevel("SEMIS")).toBe("Semifinals");
    expect(formatRoundLevel("FINALS")).toBe("Finals");
  });

  it("sorts prelims numerically rather than lexically", () => {
    expect(getRoundSortKey("R2")).toBeLessThan(getRoundSortKey("R10"));
    expect(getRoundSortKey("R10")).toBeLessThan(getRoundSortKey("TRIPLES"));
    expect(getRoundSortKey("SEMIS")).toBeLessThan(getRoundSortKey("FINALS"));
  });
});
