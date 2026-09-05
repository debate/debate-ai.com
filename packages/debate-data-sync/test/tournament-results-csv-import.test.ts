import { describe, expect, it } from "vitest";
import {
  TOURNAMENT_RESULT_CSV_TEMPLATE,
  parseTournamentResultsCsv,
} from "../src/rankings/tournament-results-csv-import";

describe("parseTournamentResultsCsv", () => {
  it("parses a well-formed multi-row CSV", () => {
    const csv = [
      "teamId,tournamentName,date,division,bidLevel,finish,prelimWins,prelimLosses",
      "Westlake AB,Berkeley,2026-01-10,PF,1,quarterfinalist,5,1",
      "Westlake AB,Harvard,2026-02-01,PF,2,octofinalist,4,2",
    ].join("\n");

    const result = parseTournamentResultsCsv(csv);

    expect(result.errors).toEqual([]);
    expect(result.skippedCount).toBe(0);
    expect(result.entries).toEqual([
      {
        teamId: "Westlake AB",
        tournamentName: "Berkeley",
        date: "2026-01-10",
        division: "PF",
        bidLevel: 1,
        finish: "quarterfinalist",
        prelimWins: 5,
        prelimLosses: 1,
      },
      {
        teamId: "Westlake AB",
        tournamentName: "Harvard",
        date: "2026-02-01",
        division: "PF",
        bidLevel: 2,
        finish: "octofinalist",
        prelimWins: 4,
        prelimLosses: 2,
      },
    ]);
  });

  it("accepts columns in any order, matched case-insensitively", () => {
    const csv = ["Finish,TEAMID,tournamentname,DATE,Division", "champion,wxyz,Berkeley,2026-01-10,PF"].join(
      "\n",
    );

    const result = parseTournamentResultsCsv(csv);

    expect(result.errors).toEqual([]);
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0]).toMatchObject({ teamId: "wxyz", finish: "champion" });
  });

  it("defaults bidLevel/prelimWins/prelimLosses to 0 when blank", () => {
    const csv = ["teamId,tournamentName,date,division,finish", "wxyz,Berkeley,2026-01-10,PF,prelims"].join(
      "\n",
    );

    const result = parseTournamentResultsCsv(csv);

    expect(result.errors).toEqual([]);
    expect(result.entries[0]).toMatchObject({ bidLevel: 0, prelimWins: 0, prelimLosses: 0 });
  });

  it("handles quoted fields containing commas", () => {
    const csv = [
      "teamId,tournamentName,date,division,finish",
      '"Westlake, AB","Berkeley Invitational",2026-01-10,PF,finalist',
    ].join("\n");

    const result = parseTournamentResultsCsv(csv);

    expect(result.errors).toEqual([]);
    expect(result.entries[0]).toMatchObject({
      teamId: "Westlake, AB",
      tournamentName: "Berkeley Invitational",
    });
  });

  it("skips a row missing a required field and reports why", () => {
    const csv = ["teamId,tournamentName,date,division,finish", ",Berkeley,2026-01-10,PF,champion"].join(
      "\n",
    );

    const result = parseTournamentResultsCsv(csv);

    expect(result.entries).toEqual([]);
    expect(result.skippedCount).toBe(1);
    expect(result.errors[0]).toMatch(/Row 2.*teamId/);
  });

  it("skips a row with an unrecognized finish and keeps parsing later rows", () => {
    const csv = [
      "teamId,tournamentName,date,division,finish",
      "wxyz,Berkeley,2026-01-10,PF,grand-champion",
      "wxyz,Glenbrooks,2026-02-01,PF,finalist",
    ].join("\n");

    const result = parseTournamentResultsCsv(csv);

    expect(result.entries).toHaveLength(1);
    expect(result.entries[0]?.tournamentName).toBe("Glenbrooks");
    expect(result.skippedCount).toBe(1);
    expect(result.errors[0]).toMatch(/Row 2.*finish/);
  });

  it("skips a row with a negative or non-numeric bidLevel/prelimWins/prelimLosses", () => {
    const csv = [
      "teamId,tournamentName,date,division,finish,bidLevel,prelimWins,prelimLosses",
      "wxyz,Berkeley,2026-01-10,PF,prelims,-1,0,0",
      "wxyz,Berkeley,2026-01-10,PF,prelims,0,many,0",
      "wxyz,Berkeley,2026-01-10,PF,prelims,0,0,1.5",
    ].join("\n");

    const result = parseTournamentResultsCsv(csv);

    expect(result.entries).toEqual([]);
    expect(result.skippedCount).toBe(3);
    expect(result.errors[0]).toMatch(/bidLevel/);
    expect(result.errors[1]).toMatch(/prelimWins/);
    expect(result.errors[2]).toMatch(/prelimLosses/);
  });

  it("reports one error and no entries when the header is missing a required column", () => {
    const csv = ["teamId,tournamentName,date,division", "wxyz,Berkeley,2026-01-10,PF"].join("\n");

    const result = parseTournamentResultsCsv(csv);

    expect(result.entries).toEqual([]);
    expect(result.skippedCount).toBe(0);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toMatch(/finish/);
  });

  it("reports one error for a fully blank input", () => {
    const result = parseTournamentResultsCsv("   \n  \n");

    expect(result.entries).toEqual([]);
    expect(result.errors).toEqual(["The CSV is empty."]);
  });

  it("ignores blank lines between data rows", () => {
    const csv = [
      "teamId,tournamentName,date,division,finish",
      "wxyz,Berkeley,2026-01-10,PF,champion",
      "",
      "wxyz,Glenbrooks,2026-02-01,PF,finalist",
    ].join("\n");

    const result = parseTournamentResultsCsv(csv);

    expect(result.entries).toHaveLength(2);
    expect(result.errors).toEqual([]);
  });

  it("ships a template that parses cleanly with exactly one entry", () => {
    const result = parseTournamentResultsCsv(TOURNAMENT_RESULT_CSV_TEMPLATE);

    expect(result.errors).toEqual([]);
    expect(result.entries).toHaveLength(1);
  });
});
