import { describe, expect, it } from "vitest";
import {
  formatRoundArgumentLines,
  parseQueuedRoundArgs,
  splitRoundArguments,
} from "../src/youtube/parsers/round-arguments";
import {
  curatedRoundDescription,
  curatedRecordToQueueRow,
  curatedRoundLevel,
  curatedTournament,
  type CuratedRoundRecord,
} from "../src/videos/curated-round-queue";

describe("splitRoundArguments", () => {
  it("puts negative positions on the 2NR and drops style tags and the topic", () => {
    expect(splitRoundArguments(["Policy v Policy", "DA", "Fast", "Resolved: X."])).toEqual({
      aff: ["Policy"],
      neg: ["DA"],
    });
    expect(splitRoundArguments(["Theory", "Disclosure", "Lay"])).toEqual({ aff: [], neg: ["Theory", "Disclosure"] });
  });

  it("keeps affirmative-sounding arguments on the aff side", () => {
    expect(splitRoundArguments(["Policy v Policy", "Heg", "Fast"])).toEqual({ aff: ["Heg"], neg: ["Policy"] });
    expect(splitRoundArguments(["Policy v Theory", "Fem Framing"])).toEqual({ aff: ["Fem Framing"], neg: ["Theory"] });
  });

  it("gives a K or phil argument to the aff when the matchup puts that family only on the aff", () => {
    expect(splitRoundArguments(["K v T-Framework", "Setcol"])).toEqual({ aff: ["Setcol"], neg: ["T-Framework"] });
    expect(splitRoundArguments(["Phil v K", "Kant", "Setcol"])).toEqual({ aff: ["Kant"], neg: ["Setcol"] });
    expect(splitRoundArguments(["Policy v K", "Setcol"])).toEqual({ aff: ["Policy"], neg: ["Setcol"] });
    expect(splitRoundArguments(["K v K", "Disability", "Fem IR"])).toEqual({ aff: ["K"], neg: ["Disability", "Fem IR"] });
  });
});

describe("parseQueuedRoundArgs", () => {
  it("round-trips the formatted lines and ignores descriptions without them", () => {
    const description = ["Topic: Resolved: X.", ...formatRoundArgumentLines({ aff: ["Kant"], neg: ["CP", "DA"] })].join("\n");
    expect(parseQueuedRoundArgs(description)).toEqual({ arg1ac: "Kant", arg2nr: "CP, DA" });
    expect(parseQueuedRoundArgs("A YouTube description")).toEqual({ arg1ac: null, arg2nr: null });
    expect(parseQueuedRoundArgs(null)).toEqual({ arg1ac: null, arg2nr: null });
  });
});

describe("curated round records", () => {
  it("parses the event into a tournament and a round level", () => {
    expect(curatedTournament("2025 TOC Double Octos")).toBe("TOC");
    expect(curatedRoundLevel("2025 TOC Double Octos")).toBe("Doubles");
    expect(curatedTournament("2025 NDCA National Championship Round 3")).toBe("NDCA National Championship");
    expect(curatedRoundLevel("2025 NDCA National Championship Round 3")).toBe("R3");
    expect(curatedTournament("2017 Harvard Round Robin Round 3")).toBe("Harvard Round Robin");
  });

  it("splits the record title into aff and neg teams", () => {
    const base = { record_id: "r", event: "2023 King Round Robin Round 2", format: "LD", arguments: [], url: "", video_id: "x" };
    expect(curatedRecordToQueueRow({ ...base, title: "Harker PG vs, Prospect ST" })).toMatchObject({ aff: "Harker PG", neg: "Prospect ST", style: 3 });
    expect(curatedRecordToQueueRow({ ...base, title: "A vs. B" })).toMatchObject({ aff: "A", neg: "B" });
  });

  it("keeps the topic and every tag in the description", () => {
    const record: CuratedRoundRecord = {
      record_id: "rec1",
      title: "A vs. B",
      event: "2024 Glenbrooks Round 3",
      format: "LD",
      arguments: ["Policy v Policy", "DA", "Fast", "Resolved: The United States ought to adopt a wealth tax."],
      url: "https://www.youtube.com/watch?v=G8h8ffqhc7A",
      video_id: "G8h8ffqhc7A",
    };
    expect(curatedRoundDescription(record)).toBe(
      [
        "Topic: Resolved: The United States ought to adopt a wealth tax.",
        "Arguments: Policy v Policy, DA, Fast",
        "Aff 1AC args: Policy",
        "Neg 2NR args: DA",
        "Event: 2024 Glenbrooks Round 3",
      ].join("\n"),
    );
  });
});
