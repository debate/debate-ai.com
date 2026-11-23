/**
 * @fileoverview `readRoundTitle`: the auto-fill title reader, checked on the
 * awkward shapes one by one and then on 415 real YouTube round titles whose
 * tournament, round and teams were labelled by hand for the curated round
 * queue (`fixtures/round-titles-labelled.json`).
 */
import { describe, expect, it } from "vitest";
import labelled from "./fixtures/round-titles-labelled.json";
import {
  canonicalRoundLevel,
  readEventPhrase,
  readRoundTitle,
} from "../src/sync/youtube/parsers/round-title";
import { canonicalTournament } from "../src/sync/youtube/parsers/tournament-names";

describe("readRoundTitle", () => {
  it("reads teams that come before the tournament", () => {
    expect(readRoundTitle("Blake TP vs. Seven Lakes LM TOC Octos 2023")).toMatchObject({
      tournament: "TOC",
      roundLevel: "Octafinals",
      affTeam: "Blake TP",
      negTeam: "Seven Lakes LM",
      sidesStated: false,
      year: 2023,
    });
  });

  it("reads pipe-separated titles", () => {
    expect(
      readRoundTitle("NSDA Nationals 2025 | Round 9 | BASIS Peoria GV vs. SF Jefferson WH | Public Forum Debate"),
    ).toMatchObject({
      tournament: "NSDA Nationals",
      roundLevel: "R9",
      affTeam: "BASIS Peoria GV",
      negTeam: "SF Jefferson WH",
    });
  });

  it("follows marked sides, even when the negative is named first", () => {
    expect(
      readRoundTitle("Strake Jesuit DY (Neg 2nd) VS Seven Lakes ML (Aff 1st) Harvard Round Robin Semis"),
    ).toMatchObject({
      tournament: "Harvard Round Robin",
      roundLevel: "Round Robin",
      affTeam: "Seven Lakes ML",
      negTeam: "Strake Jesuit DY",
      sidesStated: true,
    });
    expect(readRoundTitle("Loyola 2020 Doubles - Aff Strake Jesuit BE vs. Neg Southlake Carroll PK")).toMatchObject({
      tournament: "Loyola",
      roundLevel: "Doubles",
      affTeam: "Strake Jesuit BE",
      negTeam: "Southlake Carroll PK",
      sidesStated: true,
    });
    expect(readRoundTitle("2019 Blue Key R2 Northview SD aff vs William G Enloe AC neg")).toMatchObject({
      tournament: "Florida Blue Key",
      affTeam: "Northview SD",
      negTeam: "William G Enloe AC",
    });
  });

  it("doesn't read a team's code as a round robin", () => {
    expect(readRoundTitle("TOC 2025 LD Round 1 │ Cary Academy RR vs. Monta Vista KR")).toMatchObject({
      tournament: "TOC",
      roundLevel: "R1",
      affTeam: "Cary Academy RR",
      negTeam: "Monta Vista KR",
    });
  });

  it("names round robins after their host", () => {
    expect(readRoundTitle("2026 HWL RR - Finals - Aff Lynbrook OM vs Neg Harker SD")).toMatchObject({
      tournament: "Harvard-Westlake Round Robin",
      roundLevel: "Round Robin",
    });
    expect(readRoundTitle("Saratoga PS vs Nueva RT California Round Robin 2020")).toMatchObject({
      tournament: "Berkeley Round Robin",
      affTeam: "Saratoga PS",
      negTeam: "Nueva RT",
    });
  });

  it("splits a tournament off a team it runs into", () => {
    expect(readRoundTitle("2020 UNLV Damien ND (Aff) v Los Osos RN (Neg)")).toMatchObject({
      tournament: "UNLV",
      affTeam: "Damien ND",
      negTeam: "Los Osos RN",
    });
    expect(readRoundTitle("2019 Tournament of Champions Arcadia JC (Aff) vs Valley IN (Neg)")).toMatchObject({
      tournament: "TOC",
      affTeam: "Arcadia JC",
    });
  });

  it("keeps a school abbreviation with its code", () => {
    expect(
      readRoundTitle("[2023] Glenbrooks Speech and Debate Tournament Round 5 - Peninsula SU vs Stanford OHS AY"),
    ).toMatchObject({ tournament: "Glenbrooks", roundLevel: "R5", negTeam: "Stanford OHS AY" });
  });

  it("reads 'Championship Round 2' as a prelim, not the final", () => {
    expect(readRoundTitle("2025 NDCA National Championship Round 2: Harker SD vs. Greenhill MA")).toMatchObject({
      tournament: "NDCA National Championship",
      roundLevel: "R2",
    });
  });

  it("reads titles with no teams", () => {
    expect(readRoundTitle("NSDA Nationals 2022 - Lincoln-Douglas Debate Final Round")).toMatchObject({
      tournament: "NSDA Nationals",
      roundLevel: "Finals",
      affTeam: null,
      negTeam: null,
    });
  });

  it("ignores argument match-ups like 'Policy v K'", () => {
    expect(readRoundTitle("Policy v K: how to win the framework debate")).toMatchObject({ affTeam: null, negTeam: null });
  });

  describe("on hand-labelled round titles", () => {
    it.each(labelled as Array<{ title: string; tournament: string; roundLevel: string; teams: string[] }>)(
      "$title",
      ({ title, tournament, roundLevel, teams }) => {
        const reading = readRoundTitle(title);
        expect(reading.tournament).toBe(tournament);
        expect(reading.roundLevel).toBe(roundLevel);
        expect([reading.affTeam, reading.negTeam].sort()).toEqual(teams);
      },
    );
  });
});

describe("canonicalRoundLevel", () => {
  it.each([
    ["Round 4", "R4"],
    ["Rd. 06", "R6"],
    ["R12", "R12"],
    ["Double Octafinals", "Doubles"],
    ["Double-Octos", "Doubles"],
    ["Triple Octos", "Triples"],
    ["Octos", "Octafinals"],
    ["Quarters", "Quarterfinals"],
    ["Semi-finals", "Semifinals"],
    ["Final Round", "Finals"],
    ["Round Robin", "Round Robin"],
  ])("%s → %s", (input, expected) => {
    expect(canonicalRoundLevel(input)).toBe(expected);
  });

  it("returns null for blank or unknown", () => {
    expect(canonicalRoundLevel("")).toBeNull();
    expect(canonicalRoundLevel("Practice Round")).toBeNull();
  });
});

describe("canonicalTournament", () => {
  it.each([
    ["Tournament of Champions", "TOC"],
    ["2024 The Tournament of Champions", "TOC"],
    ["Cal", "Berkeley"],
    ["Nats", "NSDA Nationals"],
    ["NDCA National Championships", "NDCA National Championship"],
    ["HWL RR", "Harvard-Westlake Round Robin"],
    ["Kandi King RR", "King Round Robin"],
    ["Barkley Forum", "Emory"],
    ["Cavalier Invitational", "Cavalier Invitational"],
    ["California State Championship", "California State Championship"],
  ])("%s → %s", (input, expected) => {
    expect(canonicalTournament(input)).toBe(expected);
  });
});

describe("readEventPhrase", () => {
  it("reads a description's event line", () => {
    expect(readEventPhrase("2024 Glenbrooks Round 3")).toEqual({ tournament: "Glenbrooks", roundLevel: "R3" });
    expect(readEventPhrase("2025 TOC Double Octos")).toEqual({ tournament: "TOC", roundLevel: "Doubles" });
  });
});
