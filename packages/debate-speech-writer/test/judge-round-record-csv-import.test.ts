import { describe, expect, it } from "vitest";
import {
  JUDGE_ROUND_CSV_TEMPLATE,
  parseJudgeRoundRecordsCsv,
} from "../src/judge/judge-round-record-csv-import";

describe("parseJudgeRoundRecordsCsv", () => {
  it("parses a well-formed multi-row CSV", () => {
    const csv = [
      "judgeId,tournamentName,date,division,winningSide,affSpeakerPoints,negSpeakerPoints,paceWpm,theoryArgumentRaised,theoryArgumentWon,paradigmId",
      "smith,Berkeley,2026-01-10,PF,aff,28.5,28,320,true,false,flow",
      "smith,Glenbrooks,2026-02-01,PF,neg,27,29,,,,",
    ].join("\n");

    const result = parseJudgeRoundRecordsCsv(csv);

    expect(result.errors).toEqual([]);
    expect(result.skippedCount).toBe(0);
    expect(result.entries).toEqual([
      {
        judgeId: "smith",
        tournamentName: "Berkeley",
        date: "2026-01-10",
        division: "PF",
        winningSide: "aff",
        affSpeakerPoints: 28.5,
        negSpeakerPoints: 28,
        paceWpm: 320,
        theoryArgumentRaised: true,
        theoryArgumentWon: false,
        paradigmId: "flow",
      },
      {
        judgeId: "smith",
        tournamentName: "Glenbrooks",
        date: "2026-02-01",
        division: "PF",
        winningSide: "neg",
        affSpeakerPoints: 27,
        negSpeakerPoints: 29,
        paceWpm: undefined,
        theoryArgumentRaised: false,
        theoryArgumentWon: false,
        paradigmId: undefined,
      },
    ]);
  });

  it("accepts columns in any order, matched case-insensitively", () => {
    const csv = [
      "WinningSide,JUDGEID,tournamentname,DATE,Division,affspeakerpoints,negspeakerpoints",
      "neg,smith,Berkeley,2026-01-10,PF,27,29",
    ].join("\n");

    const result = parseJudgeRoundRecordsCsv(csv);

    expect(result.errors).toEqual([]);
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0]).toMatchObject({ judgeId: "smith", winningSide: "neg" });
  });

  it("only counts theoryArgumentWon when theoryArgumentRaised is true, mirroring the panel form", () => {
    const csv = [
      "judgeId,tournamentName,date,division,winningSide,affSpeakerPoints,negSpeakerPoints,theoryArgumentRaised,theoryArgumentWon",
      "smith,Berkeley,2026-01-10,PF,aff,28,28,false,true",
    ].join("\n");

    const result = parseJudgeRoundRecordsCsv(csv);

    expect(result.errors).toEqual([]);
    expect(result.entries[0]).toMatchObject({
      theoryArgumentRaised: false,
      theoryArgumentWon: false,
    });
  });

  it("skips a row missing a required field and reports why", () => {
    const csv = [
      "judgeId,tournamentName,date,division,winningSide,affSpeakerPoints,negSpeakerPoints",
      ",Berkeley,2026-01-10,PF,aff,28,28",
    ].join("\n");

    const result = parseJudgeRoundRecordsCsv(csv);

    expect(result.entries).toEqual([]);
    expect(result.skippedCount).toBe(1);
    expect(result.errors[0]).toMatch(/Row 2.*judgeId/);
  });

  it("skips a row with an unrecognized winningSide and keeps parsing later rows", () => {
    const csv = [
      "judgeId,tournamentName,date,division,winningSide,affSpeakerPoints,negSpeakerPoints",
      "smith,Berkeley,2026-01-10,PF,sideways,28,28",
      "smith,Glenbrooks,2026-02-01,PF,neg,27,29",
    ].join("\n");

    const result = parseJudgeRoundRecordsCsv(csv);

    expect(result.entries).toHaveLength(1);
    expect(result.entries[0]?.tournamentName).toBe("Glenbrooks");
    expect(result.skippedCount).toBe(1);
    expect(result.errors[0]).toMatch(/Row 2.*winningSide/);
  });

  it("skips a row with non-numeric speaker points", () => {
    const csv = [
      "judgeId,tournamentName,date,division,winningSide,affSpeakerPoints,negSpeakerPoints",
      "smith,Berkeley,2026-01-10,PF,aff,many,28",
    ].join("\n");

    const result = parseJudgeRoundRecordsCsv(csv);

    expect(result.entries).toEqual([]);
    expect(result.skippedCount).toBe(1);
    expect(result.errors[0]).toMatch(/Row 2.*affSpeakerPoints/);
  });

  it("skips a row with a non-numeric pace", () => {
    const csv = [
      "judgeId,tournamentName,date,division,winningSide,affSpeakerPoints,negSpeakerPoints,paceWpm",
      "smith,Berkeley,2026-01-10,PF,aff,28,28,fast",
    ].join("\n");

    const result = parseJudgeRoundRecordsCsv(csv);

    expect(result.entries).toEqual([]);
    expect(result.skippedCount).toBe(1);
    expect(result.errors[0]).toMatch(/Row 2.*paceWpm/);
  });

  it("skips a row with an unrecognized paradigmId", () => {
    const csv = [
      "judgeId,tournamentName,date,division,winningSide,affSpeakerPoints,negSpeakerPoints,paradigmId",
      "smith,Berkeley,2026-01-10,PF,aff,28,28,made-up",
    ].join("\n");

    const result = parseJudgeRoundRecordsCsv(csv);

    expect(result.entries).toEqual([]);
    expect(result.skippedCount).toBe(1);
    expect(result.errors[0]).toMatch(/Row 2.*paradigmId/);
  });

  it("matches paradigmId case-insensitively", () => {
    const csv = [
      "judgeId,tournamentName,date,division,winningSide,affSpeakerPoints,negSpeakerPoints,paradigmId",
      "smith,Berkeley,2026-01-10,PF,aff,28,28,FLOW",
    ].join("\n");

    const result = parseJudgeRoundRecordsCsv(csv);

    expect(result.errors).toEqual([]);
    expect(result.entries[0]?.paradigmId).toBe("flow");
  });

  it("reports one error and no entries when the header is missing a required column", () => {
    const csv = ["judgeId,tournamentName,date,division", "smith,Berkeley,2026-01-10,PF"].join("\n");

    const result = parseJudgeRoundRecordsCsv(csv);

    expect(result.entries).toEqual([]);
    expect(result.skippedCount).toBe(0);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toMatch(/winningSide/);
    expect(result.errors[0]).toMatch(/affSpeakerPoints/);
  });

  it("reports one error for a fully blank input", () => {
    const result = parseJudgeRoundRecordsCsv("   \n  \n");

    expect(result.entries).toEqual([]);
    expect(result.errors).toEqual(["The CSV is empty."]);
  });

  it("ignores blank lines between data rows", () => {
    const csv = [
      "judgeId,tournamentName,date,division,winningSide,affSpeakerPoints,negSpeakerPoints",
      "smith,Berkeley,2026-01-10,PF,aff,28,28",
      "",
      "smith,Glenbrooks,2026-02-01,PF,neg,27,29",
    ].join("\n");

    const result = parseJudgeRoundRecordsCsv(csv);

    expect(result.entries).toHaveLength(2);
    expect(result.errors).toEqual([]);
  });

  it("ships a template that parses cleanly with exactly one entry", () => {
    const result = parseJudgeRoundRecordsCsv(JUDGE_ROUND_CSV_TEMPLATE);

    expect(result.errors).toEqual([]);
    expect(result.entries).toHaveLength(1);
  });
});
