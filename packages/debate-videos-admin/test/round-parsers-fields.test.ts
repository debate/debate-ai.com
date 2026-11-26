// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  parseJudgeDecision,
  parseRoundLevel,
  parseTeams,
  parseTournament,
  parseWinner,
} from "../src/sync/youtube/parsers/round-parsers";

describe("parseTournament", () => {
  it.each([
    ["2024 Tournament of Champions LD R4: Horace Greeley SG vs OCSA IL", "TOC"],
    ["2024 Tournament of Champions LD Doubles: Horace Greeley SG vs Monta Vista EY", "TOC"],
    ["2024 Tournament of Champions Doubles: Team1 vs Team2", "TOC"],
    ["2012 NDT Finals -- Northwestern BK v Georgetown AM", "NDT"],
    ["2015 National Debate Tournament Round 5 Policy -- A v B", "NDT"],
    ["Wake Forest 2009 Quarters -- MSU LW v UTD BR", "Wake Forest"],
    ["Harvard 2021 Policy Finals: A vs B", "Harvard"],
  ])("reads the tournament out of %s", (title, tournament) => {
    expect(parseTournament(title)).toBe(tournament);
  });

  it("saves the name without its year", () => {
    expect(parseTournament("2019 Apple Valley Quarterfinals Strake WH (Aff) vs Santa Monica RE (Neg)")).toBe("Apple Valley");
    expect(parseTournament("2022 Greenhill LD Round 6 Saratoga AG (Aff) vs Oxford VM (Neg)")).not.toMatch(/\d{4}/);
  });

  it("returns null when a title names no tournament", () => {
    expect(parseTournament("Some video with no year: A vs B")).toBeNull();
    expect(parseTournament("no separator here")).toBeNull();
    expect(parseTournament("Berkeley -- A B v. C D Analysis")).toBeNull();
  });
});

describe("parseTeams", () => {
  it("reads the Aff and Neg teams out of side-marked titles", () => {
    expect(parseTeams("2022 Greenhill LD Round 6 Saratoga AG (Aff) vs Oxford VM (Neg)")).toEqual({
      aff: "Saratoga AG",
      neg: "Oxford VM",
    });
  });

  it("splits a dashed title on a single v, dropping a trailing Analysis label", () => {
    expect(parseTeams("2012 NDT Finals -- Northwestern BK v Georgetown AM")).toEqual({
      aff: "Northwestern BK",
      neg: "Georgetown AM",
    });
    expect(parseTeams("TOC -- Michigan KM v Northwestern BC Round Analysis")).toEqual({
      aff: "Michigan KM",
      neg: "Northwestern BC",
    });
  });

  it("splits a colon title on vs, dropping side markers and anything after the Neg one", () => {
    expect(parseTeams("TOC Doubles: Team1 vs. Team2")).toEqual({ aff: "Team1", neg: "Team2" });
    expect(parseTeams("Berkeley: Michigan KM (Aff) vs. Northwestern BC (Neg) extra")).toEqual({
      aff: "Michigan KM",
      neg: "Northwestern BC",
    });
  });

  it("splits a dashed title on v.", () => {
    expect(parseTeams("Berkeley -- A B v. C D Analysis")).toEqual({ aff: "A B", neg: "C D" });
  });

  it("returns nulls when no matchup is spelled out", () => {
    expect(parseTeams("no teams")).toEqual({ aff: null, neg: null });
    expect(parseTeams("NPDA Finals Rice RS v. Berkeley SK")).toEqual({ aff: null, neg: null });
  });
});

describe("parseRoundLevel fallbacks", () => {
  it("reads prelim rounds in every spelling and the remaining elim names", () => {
    expect(parseRoundLevel("Round 4 something")).toBe("R4");
    expect(parseRoundLevel("R7 whatever")).toBe("R7");
    expect(parseRoundLevel("Final")).toBe("Finals");
    expect(parseRoundLevel("Runoff")).toBe("Runoffs");
    expect(parseRoundLevel("Triples")).toBe("Triples");
  });

  it("returns null with no round level", () => {
    expect(parseRoundLevel("An unrelated video")).toBeNull();
  });
});

describe("parseWinner", () => {
  it("reads the side that won from several phrasings", () => {
    expect(parseWinner("3-0 for the affirmative")).toBe(true);
    expect(parseWinner("Aff wins")).toBe(true);
    expect(parseWinner("Affirmative wins")).toBe(true);
    expect(parseWinner("Neg win")).toBe(false);
    expect(parseWinner("2-1 for neg")).toBe(false);
    expect(parseWinner("this is unanimous... affirmative")).toBe(true);
    expect(parseWinner("a unanimous decision for the negative team")).toBe(false);
  });

  it("returns null when the description gives no winner", () => {
    expect(parseWinner("")).toBeNull();
    expect(parseWinner("nothing here")).toBeNull();
    expect(parseWinner("Unanimous")).toBeNull();
  });
});

describe("parseJudgeDecision", () => {
  it("keeps the vote and the judge panel", () => {
    expect(parseJudgeDecision("3-0 for the affirmative (Smith, Jones, *Lee)")).toBe("3-0 (Smith, Jones, *Lee)");
  });

  it("names the judges of a unanimous decision when listed", () => {
    expect(parseJudgeDecision("Unanimous decision\nJudges: Smith, Lee")).toBe("Unanimous (Smith, Lee)");
    expect(parseJudgeDecision("Unanimous")).toBe("Unanimous");
  });

  it("falls back to a bare vote split", () => {
    expect(parseJudgeDecision("vote 2-1 here")).toBe("2-1");
    expect(parseJudgeDecision("2-1 for neg")).toBe("2-1");
  });

  it("returns null with no decision", () => {
    expect(parseJudgeDecision("")).toBeNull();
    expect(parseJudgeDecision("nothing")).toBeNull();
  });
});
