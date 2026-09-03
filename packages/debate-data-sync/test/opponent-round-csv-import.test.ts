import { describe, expect, it } from "vitest";
import {
  OPPONENT_ROUND_CSV_TEMPLATE,
  parseOpponentRoundRecordsCsv,
} from "../src/rankings/opponent-round-csv-import";

describe("parseOpponentRoundRecordsCsv", () => {
  it("parses a well-formed multi-row CSV", () => {
    const csv = [
      "teamId,tournamentName,date,division,side,won,argumentTags,caseName,opponentTeamId",
      "Westlake AB,Berkeley,2026-01-10,PF,aff,true,kritik;topicality,Housing Case,Lincoln CD",
      "Westlake AB,Glenbrooks,2026-02-01,PF,neg,false,,,",
    ].join("\n");

    const result = parseOpponentRoundRecordsCsv(csv);

    expect(result.errors).toEqual([]);
    expect(result.skippedCount).toBe(0);
    expect(result.entries).toEqual([
      {
        teamId: "Westlake AB",
        tournamentName: "Berkeley",
        date: "2026-01-10",
        division: "PF",
        side: "aff",
        won: true,
        argumentTags: ["kritik", "topicality"],
        caseName: "Housing Case",
        opponentTeamId: "Lincoln CD",
      },
      {
        teamId: "Westlake AB",
        tournamentName: "Glenbrooks",
        date: "2026-02-01",
        division: "PF",
        side: "neg",
        won: false,
        argumentTags: undefined,
        caseName: undefined,
        opponentTeamId: undefined,
      },
    ]);
  });

  it("accepts columns in any order, matched case-insensitively", () => {
    const csv = ["Side,Won,TEAMID,tournamentname,DATE,Division", "neg,yes,wxyz,Berkeley,2026-01-10,PF"].join(
      "\n",
    );

    const result = parseOpponentRoundRecordsCsv(csv);

    expect(result.errors).toEqual([]);
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0]).toMatchObject({ teamId: "wxyz", side: "neg", won: true });
  });

  it("handles quoted fields containing commas and escaped quotes", () => {
    const csv = [
      "teamId,tournamentName,date,division,side,won,argumentTags,caseName,opponentTeamId",
      '"Westlake, AB",Berkeley,2026-01-10,PF,aff,true,,"The ""Housing"" Case",',
    ].join("\n");

    const result = parseOpponentRoundRecordsCsv(csv);

    expect(result.errors).toEqual([]);
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0]).toMatchObject({
      teamId: "Westlake, AB",
      caseName: 'The "Housing" Case',
    });
  });

  it("accepts common truthy/falsy spellings for won", () => {
    const rows = ["1", "0", "Y", "N", "Win", "Loss"];
    const csv = [
      "teamId,tournamentName,date,division,side,won",
      ...rows.map((won) => `wxyz,Berkeley,2026-01-10,PF,aff,${won}`),
    ].join("\n");

    const result = parseOpponentRoundRecordsCsv(csv);

    expect(result.errors).toEqual([]);
    expect(result.entries.map((entry) => entry.won)).toEqual([true, false, true, false, true, false]);
  });

  it("skips a row missing a required field and reports why", () => {
    const csv = [
      "teamId,tournamentName,date,division,side,won",
      ",Berkeley,2026-01-10,PF,aff,true",
    ].join("\n");

    const result = parseOpponentRoundRecordsCsv(csv);

    expect(result.entries).toEqual([]);
    expect(result.skippedCount).toBe(1);
    expect(result.errors[0]).toMatch(/Row 2.*teamId/);
  });

  it("skips a row with an unrecognized side and keeps parsing later rows", () => {
    const csv = [
      "teamId,tournamentName,date,division,side,won",
      "wxyz,Berkeley,2026-01-10,PF,sideways,true",
      "wxyz,Glenbrooks,2026-02-01,PF,neg,true",
    ].join("\n");

    const result = parseOpponentRoundRecordsCsv(csv);

    expect(result.entries).toHaveLength(1);
    expect(result.entries[0]?.tournamentName).toBe("Glenbrooks");
    expect(result.skippedCount).toBe(1);
    expect(result.errors[0]).toMatch(/Row 2.*side/);
  });

  it("skips a row with an unrecognized won value", () => {
    const csv = ["teamId,tournamentName,date,division,side,won", "wxyz,Berkeley,2026-01-10,PF,aff,maybe"].join(
      "\n",
    );

    const result = parseOpponentRoundRecordsCsv(csv);

    expect(result.entries).toEqual([]);
    expect(result.skippedCount).toBe(1);
    expect(result.errors[0]).toMatch(/Row 2.*won/);
  });

  it("reports one error and no entries when the header is missing a required column", () => {
    const csv = ["teamId,tournamentName,date,division", "wxyz,Berkeley,2026-01-10,PF"].join("\n");

    const result = parseOpponentRoundRecordsCsv(csv);

    expect(result.entries).toEqual([]);
    expect(result.skippedCount).toBe(0);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toMatch(/side/);
    expect(result.errors[0]).toMatch(/won/);
  });

  it("reports one error for a fully blank input", () => {
    const result = parseOpponentRoundRecordsCsv("   \n  \n");

    expect(result.entries).toEqual([]);
    expect(result.errors).toEqual(["The CSV is empty."]);
  });

  it("ignores blank lines between data rows", () => {
    const csv = [
      "teamId,tournamentName,date,division,side,won",
      "wxyz,Berkeley,2026-01-10,PF,aff,true",
      "",
      "wxyz,Glenbrooks,2026-02-01,PF,neg,false",
    ].join("\n");

    const result = parseOpponentRoundRecordsCsv(csv);

    expect(result.entries).toHaveLength(2);
    expect(result.errors).toEqual([]);
  });

  it("ships a template that parses cleanly with exactly one entry", () => {
    const result = parseOpponentRoundRecordsCsv(OPPONENT_ROUND_CSV_TEMPLATE);

    expect(result.errors).toEqual([]);
    expect(result.entries).toHaveLength(1);
  });
});
