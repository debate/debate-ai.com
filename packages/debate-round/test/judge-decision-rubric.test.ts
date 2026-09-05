import { describe, expect, it } from "vitest";
import {
  buildJudgeDecisionRubric,
  countAddressedRubricRows,
} from "../src/round/judge-decision-rubric";
import { judgeParadigms } from "debate-speech-writer/src/judge/judge-paradigms";

const PARADIGM = judgeParadigms.flow;
// PARADIGM.votingPriorities, for reference:
// 0. "Dropped or conceded arguments"
// 1. "Argument interaction and clash"
// 2. "Impact calculus (magnitude, probability, timeframe)"
// 3. "Framework/weighing mechanism established in-round"

describe("buildJudgeDecisionRubric", () => {
  it("returns one row per voting priority, in the paradigm's own order", () => {
    const rows = buildJudgeDecisionRubric(PARADIGM, { keyVotingIssues: ["Solvency deficit"] });

    expect(rows.map((row) => row.criterion)).toEqual(PARADIGM.votingPriorities);
  });

  it("matches a criterion to whichever issue shares the most significant words", () => {
    const rows = buildJudgeDecisionRubric(PARADIGM, {
      keyVotingIssues: [
        "Negative dropped the aff's turn on case",
        "Judge weighed impact calculus heavily",
      ],
    });

    expect(rows[0]).toEqual({
      criterion: "Dropped or conceded arguments",
      addressed: true,
      matchedIssue: "Negative dropped the aff's turn on case",
    });
    expect(rows[2]).toEqual({
      criterion: "Impact calculus (magnitude, probability, timeframe)",
      addressed: true,
      matchedIssue: "Judge weighed impact calculus heavily",
    });
  });

  it("leaves a criterion unaddressed when no issue shares a significant word", () => {
    const rows = buildJudgeDecisionRubric(PARADIGM, {
      keyVotingIssues: ["Negative dropped the aff's turn on case"],
    });

    expect(rows[1]).toEqual({ criterion: "Argument interaction and clash", addressed: false });
    expect(rows[1].matchedIssue).toBeUndefined();
  });

  it("breaks a tied overlap count in favor of the earlier-listed issue", () => {
    const rows = buildJudgeDecisionRubric(PARADIGM, {
      keyVotingIssues: ["There was clash on argument", "Direct clash and argument style"],
    });

    expect(rows[1]).toEqual({
      criterion: "Argument interaction and clash",
      addressed: true,
      matchedIssue: "There was clash on argument",
    });
  });

  it("leaves every criterion unaddressed for an empty issue list", () => {
    const rows = buildJudgeDecisionRubric(PARADIGM, { keyVotingIssues: [] });

    expect(rows.every((row) => row.addressed === false)).toBe(true);
    expect(rows.every((row) => row.matchedIssue === undefined)).toBe(true);
  });

  it("ignores short/common words so they can't drive a false match on their own", () => {
    // "and", "the", "with" etc. are excluded from overlap matching.
    const rows = buildJudgeDecisionRubric(PARADIGM, {
      keyVotingIssues: ["The team came in with lots of energy and spirit"],
    });

    expect(rows.every((row) => row.addressed === false)).toBe(true);
  });
});

describe("countAddressedRubricRows", () => {
  it("counts only the addressed rows", () => {
    const rows = buildJudgeDecisionRubric(PARADIGM, {
      keyVotingIssues: ["Negative dropped the aff's turn on case"],
    });

    expect(countAddressedRubricRows(rows)).toBe(1);
  });

  it("returns 0 when no rows are addressed", () => {
    expect(countAddressedRubricRows([])).toBe(0);
  });
});
