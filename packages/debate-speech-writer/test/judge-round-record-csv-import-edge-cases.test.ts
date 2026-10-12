/**
 * @fileoverview Edge cases for `judge/judge-round-record-csv-import.ts`
 * beyond `judge-round-record-csv-import.test.ts`: quoted fields with
 * embedded commas and escaped quotes, the yes/no/1/0 boolean spellings,
 * and the neg-points / theory-boolean validation branches.
 */

import { describe, expect, it } from "vitest";

import { parseJudgeRoundRecordsCsv } from "../src/judge/judge-round-record-csv-import";

const HEADER =
  "judgeId,tournamentName,date,division,winningSide,affSpeakerPoints,negSpeakerPoints,paceWpm,theoryArgumentRaised,theoryArgumentWon,paradigmId";

describe("parseJudgeRoundRecordsCsv quoting", () => {
  it("keeps commas inside quoted fields and unescapes doubled quotes", () => {
    const csv = [HEADER, `smith,"Berkeley, ""Cal"" Invitational",2026-01-10,"PF, Varsity",aff,28.5,28,,,,`].join("\n");
    const result = parseJudgeRoundRecordsCsv(csv);
    expect(result.errors).toEqual([]);
    expect(result.entries).toEqual([
      expect.objectContaining({
        judgeId: "smith",
        tournamentName: 'Berkeley, "Cal" Invitational',
        division: "PF, Varsity",
        affSpeakerPoints: 28.5,
        negSpeakerPoints: 28,
        paceWpm: undefined,
        theoryArgumentRaised: false,
        theoryArgumentWon: false,
        paradigmId: undefined,
      }),
    ]);
  });
});

describe("parseJudgeRoundRecordsCsv booleans", () => {
  it.each([
    ["yes", "y", true, true],
    ["1", "0", true, false],
    ["Y", "No", true, false],
    ["n", "1", false, false],
  ])("reads raised=%s won=%s", (raised, won, expectedRaised, expectedWon) => {
    const csv = [HEADER, `smith,Berkeley,2026-01-10,PF,neg,27,29,250,${raised},${won},`].join("\n");
    const [entry] = parseJudgeRoundRecordsCsv(csv).entries;
    expect(entry.theoryArgumentRaised).toBe(expectedRaised);
    expect(entry.theoryArgumentWon).toBe(expectedWon);
    expect(entry.paceWpm).toBe(250);
  });
});

describe("parseJudgeRoundRecordsCsv validation", () => {
  it("skips a row with blank or non-numeric neg speaker points", () => {
    const csv = [
      HEADER,
      "smith,Berkeley,2026-01-10,PF,aff,28,,,,,",
      "smith,Berkeley,2026-01-11,PF,aff,28,lots,,,,",
      "smith,Berkeley,2026-01-12,PF,aff,28,27,,,,",
    ].join("\n");
    const result = parseJudgeRoundRecordsCsv(csv);
    expect(result.skippedCount).toBe(2);
    expect(result.errors).toEqual([
      'Row 2: "negSpeakerPoints" must be a number, got "".',
      'Row 3: "negSpeakerPoints" must be a number, got "lots".',
    ]);
    expect(result.entries.map((entry) => entry.date)).toEqual(["2026-01-12"]);
  });

  it("skips a row with an unrecognized theoryArgumentRaised value", () => {
    const csv = [HEADER, "smith,Berkeley,2026-01-10,PF,aff,28,27,,maybe,,"].join("\n");
    const result = parseJudgeRoundRecordsCsv(csv);
    expect(result.entries).toEqual([]);
    expect(result.errors).toEqual([
      'Row 2: "theoryArgumentRaised" must be true/false (or yes/no, 1/0), got "maybe".',
    ]);
  });

  it("skips a row with an unrecognized theoryArgumentWon value", () => {
    const csv = [HEADER, "smith,Berkeley,2026-01-10,PF,aff,28,27,,true,sometimes,"].join("\n");
    const result = parseJudgeRoundRecordsCsv(csv);
    expect(result.entries).toEqual([]);
    expect(result.skippedCount).toBe(1);
    expect(result.errors[0]).toBe(
      'Row 2: "theoryArgumentWon" must be true/false (or yes/no, 1/0), got "sometimes".',
    );
  });

  it("lists every missing required field in one message", () => {
    const csv = [HEADER, ",,,PF,aff,28,27,,,,"].join("\n");
    const result = parseJudgeRoundRecordsCsv(csv);
    expect(result.errors).toEqual(["Row 2: missing required field(s): judgeId, tournamentName, date."]);
  });
});
