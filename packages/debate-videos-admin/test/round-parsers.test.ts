// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  parseDebateStyle,
  parseRoundLevel,
  parseWinner,
} from "../src/sync/youtube/parsers/round-parsers";

describe("parseDebateStyle", () => {
  it("detects the format named in the title", () => {
    expect(parseDebateStyle("Bronx LD Finals")).toBe(3);
    expect(parseDebateStyle("Public Forum Semis")).toBe(2);
    expect(parseDebateStyle("Policy Round 3")).toBe(1);
    expect(parseDebateStyle("NDT Doubles")).toBe(4);
  });

  it("files Dartmouth RR rounds as college, whatever else the title says", () => {
    expect(parseDebateStyle("Dartmouth RR 2024 Round 3: Michigan KS vs Harvard HS")).toBe(4);
    expect(parseDebateStyle("Dartmouth Round Robin Policy Finals")).toBe(4);
  });

  it("files parliamentary rounds as Parli, ahead of the policy keywords", () => {
    expect(parseDebateStyle("2024 NPDA Finals Rice University RS v. Parli Debate at Berkeley SK (Neg)")).toBe(8);
    expect(parseDebateStyle("NPTE Semis: Washington vs Oregon")).toBe(8);
    expect(parseDebateStyle("Parliamentary Debate Policy Motion Round 2")).toBe(8);
    expect(parseDebateStyle("British Parliament speech")).toBe(1);
  });

  it("files congressional rounds as Congress", () => {
    expect(parseDebateStyle("2024 Congress Finals: Bellaire vs Harvard")).toBe(9);
    expect(parseDebateStyle("Congress Semis: Greenhill vs Bronx")).toBe(9);
  });

  it("falls back to PF for the DebateDrills channel", () => {
    expect(parseDebateStyle("Smith vs Jones", "DebateDrills")).toBe(2);
  });

  it("defaults to policy for anything else", () => {
    expect(parseDebateStyle("Smith vs Jones", "Some Channel")).toBe(1);
  });

  it("prefers the title over the channel default", () => {
    expect(parseDebateStyle("Lincoln Douglas Finals", "DebateDrills")).toBe(3);
  });
});

describe("parseRoundLevel", () => {
  it("normalizes elimination round aliases", () => {
    expect(parseRoundLevel("TOC Semis: A vs B")).toBe("Semifinals");
    expect(parseRoundLevel("TOC Quarters: A vs B")).toBe("Quarterfinals");
    expect(parseRoundLevel("TOC Octas: A vs B")).toBe("Octafinals");
    expect(parseRoundLevel("TOC Final: A vs B")).toBe("Finals");
    expect(parseRoundLevel("TOC Doubles: A vs B")).toBe("Doubles");
  });

  it("recognizes round robins", () => {
    expect(parseRoundLevel("Glenbrooks Round Robin")).toBe("Round Robin");
  });

  it("shortens prelim rounds to R<n>", () => {
    expect(parseRoundLevel("Berkeley Round 5: A vs B")).toBe("R5");
    expect(parseRoundLevel("Berkeley R2: A vs B")).toBe("R2");
  });

  it("returns null when no round level is present", () => {
    expect(parseRoundLevel("Impact Calculus Lecture")).toBeNull();
  });
});

describe("parseWinner", () => {
  it("returns null when the description states no decision", () => {
    expect(parseWinner("A great round with no listed decision.")).toBeNull();
  });
});
