/**
 * @fileoverview The rule-based half of auto-fill: what common round titles
 * yield without the model, and when the model is still needed.
 */
import { describe, expect, it } from "vitest";
import { cleanTeam, describeTitleFields, explicitStyle, readTitleFields, speechDocsLink } from "../video-title-fields";

describe("readTitleFields", () => {
  it("reads a full TOC-style title and skips the model", () => {
    const result = readTitleFields({
      title: "2024 Tournament of Champions LD Finals: Horace Greeley SG vs Monta Vista EY",
      description: "Watch the final round.",
    });
    expect(result.isRound).toBe(true);
    expect(result.needsModel).toBe(false);
    expect(result.fields).toMatchObject({
      style: 3,
      category: null,
      tournament: "TOC",
      roundLevel: "Finals",
      affTeam: "Horace Greeley SG",
      negTeam: "Monta Vista EY",
    });
  });

  it("reads explicit sides, the result and a doc link from the description", () => {
    const result = readTitleFields({
      title: "2019 Apple Valley PF Quarterfinals Strake WH (Aff) vs Santa Monica RE (Neg)",
      description: "2-1 for the affirmative (Smith, Jones, *Lee)\nDocs: https://docs.google.com/document/d/abc123.",
    });
    expect(result.fields).toMatchObject({
      style: 2,
      affTeam: "Strake WH",
      negTeam: "Santa Monica RE",
      affWin: true,
      judgeDecision: "2-1 (Smith, Jones, *Lee)",
      speechDocsUrl: "https://docs.google.com/document/d/abc123",
    });
  });

  it("asks the model when the format isn't named", () => {
    const result = readTitleFields({ title: "2012 TOC Finals -- Northwestern BK v Georgetown AM", description: "" });
    expect(result.fields.style).toBeUndefined();
    expect(result.fields.affTeam).toBe("Northwestern BK");
    expect(result.needsModel).toBe(true);
  });

  it("asks the model when the description talks about arguments it can't read", () => {
    const result = readTitleFields({
      title: "2024 Glenbrooks Policy Semis: Damien JS vs Lexington AK",
      description: "The 1AC was a nuclear plan; the neg went for a Politics DA.",
    });
    expect(result.needsModel).toBe(true);
  });

  it("leaves lectures to the model", () => {
    const result = readTitleFields({ title: "How to write a 2NR", description: "A lecture on rebuttals." });
    expect(result).toMatchObject({ isRound: false, needsModel: true, fields: {} });
  });

  it("ignores a season range as a decision", () => {
    const result = readTitleFields({
      title: "2024 Glenbrooks Policy Finals: Damien JS vs Lexington AK",
      description: "From the 2023-24 season.",
    });
    expect(result.fields.judgeDecision).toBeUndefined();
  });
});

describe("helpers", () => {
  it("names a format only when the title does", () => {
    expect(explicitStyle("2012 NDT Finals")).toBe(4);
    expect(explicitStyle("Glenbrooks CX Octas")).toBe(1);
    expect(explicitStyle("TOC Finals")).toBeNull();
  });

  it("finds only speech-doc hosts", () => {
    expect(speechDocsLink("see https://example.com/x")).toBeNull();
    expect(speechDocsLink("docs (https://opencaselist.com/hspolicy24/X)")).toBe("https://opencaselist.com/hspolicy24/X");
  });

  it("describes readings in the model's keys", () => {
    expect(describeTitleFields({ style: 3, affWin: false, tournament: "TOC", category: null })).toBe(
      "style: ld\ntournament: TOC\nwinner: neg",
    );
  });
});

describe("cleanTeam", () => {
  it("drops title text swept in ahead of the team and trailing tails", () => {
    expect(cleanTeam("Apple Valley PF Quarterfinals Strake WH")).toBe("Strake WH");
    expect(cleanTeam("Georgetown AM | Debate Videos")).toBe("Georgetown AM");
    expect(cleanTeam("Northwestern BK")).toBe("Northwestern BK");
  });
});
