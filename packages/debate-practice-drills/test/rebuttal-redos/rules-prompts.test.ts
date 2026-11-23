import { describe, expect, it } from "vitest";
import {
  availableRedoMoves,
  extractSpeechText,
  fiatPointsFor,
  fiatSummary,
  inferRedoFormat,
  redoSeats,
} from "../../src/rebuttal-redos/rules";
import { fallbackInstructions, parseRedoAssignments, redoAssignmentPrompt } from "../../src/rebuttal-redos/prompts";
import { buildRedoRound, isRoundJudge } from "../../src/rebuttal-redos/round-input";
import { parseNewRedoRound, parseRedoUpdate } from "../../src/rebuttal-redos/validation";

const POLICY_COLUMNS = ["1AC", "1NC", "2AC", "2NC/1NR", "1AR", "2NR", "2AR"];

describe("rebuttal redo seats", () => {
  it("gives each policy speaker their own rebuttal and drops blanks and repeats", () => {
    const seats = redoSeats("policy", [
      { email: "a1@x.com", side: "aff", position: 0 },
      { email: "a2@x.com", side: "aff", position: 1 },
      { email: "n1@x.com", side: "neg", position: 0 },
      { email: "N1@x.com", side: "neg", position: 1 },
      { email: " ", side: "neg", position: 1 },
    ]);
    expect(seats.map((seat) => `${seat.email} ${seat.speech}`)).toEqual(["a1@x.com 1AR", "a2@x.com 2AR", "n1@x.com 1NR"]);
  });

  it("gives LD only the first seat, and PF summary then final focus", () => {
    expect(redoSeats("ld", [{ email: "a@x.com", side: "aff", position: 1 }])).toEqual([]);
    expect(redoSeats("pf", [{ email: "b@x.com", side: "neg", position: 1 }])[0]?.speech).toBe("Final Focus");
  });

  it("guesses the format from flow columns", () => {
    expect(inferRedoFormat(POLICY_COLUMNS)).toBe("policy");
    expect(inferRedoFormat(["AC", "NC", "1AR", "NR", "2AR"])).toBe("ld");
    expect(inferRedoFormat(["Constructive", "Rebuttal", "Summary", "Final Focus"])).toBe("pf");
  });
});

describe("reading a rebuttal off the flow", () => {
  const flow = {
    columns: POLICY_COLUMNS,
    children: [
      {
        content: "Adv 1 — warming",
        children: [{ content: "No impact", children: [{ content: "Extend Smith", children: [{ content: "Cards dropped", children: [{ content: "Extend the link turn", children: [] }] }] }] }],
      },
    ],
    speechDocs: { "2NC/1NR": "<p>Case &amp; DA</p>" },
  };

  it("collects the rows in the speech's column and its speech doc", () => {
    expect(extractSpeechText([flow], "1AR")).toBe("- Extend the link turn");
    expect(extractSpeechText([flow], "1NR")).toContain("- Cards dropped");
    expect(extractSpeechText([flow], "1NR")).toContain("Case & DA");
    expect(extractSpeechText([flow], "2AR")).toBe("");
  });

  it("builds the generate body from a workspace round", () => {
    const round = {
      id: 42,
      tournamentName: "Glenbrooks",
      roundLevel: "Octos",
      debaters: { aff: ["a1@x.com", "a2@x.com"], neg: ["n1@x.com", ""] },
      judges: ["Judge@x.com"],
      flowIds: [7],
    };
    const body = buildRedoRound(round, [{ ...flow, id: 7 }]);
    expect(body).toMatchObject({ roundId: "42", roundTitle: "Glenbrooks — Octos", format: "policy" });
    expect(body.debaters).toHaveLength(3);
    expect(body.speeches["Aff 1AR"]).toBe("- Extend the link turn");
    expect(isRoundJudge(round, "judge@X.com")).toBe(true);
    expect(isRoundJudge(round, "a1@x.com")).toBe(false);
    expect(parseNewRedoRound(body).ok).toBe(true);
  });
});

describe("assignment prompt", () => {
  const seats = [{ email: "n@x.com", side: "neg" as const, speech: "2NR" }];

  it("names every seat and asks for JSON", () => {
    const prompt = redoAssignmentPrompt({ format: "policy", roundTitle: "Finals", winner: "aff", judgeNotes: "Neg undercovered the perm.", speeches: { "Neg 2NR": "- Extend the DA" } }, seats);
    expect(prompt).toContain("### Neg 2NR");
    expect(prompt).toContain("Extend the DA");
    expect(prompt).toContain("undercovered the perm");
    expect(prompt).toContain('"assignments"');
  });

  it("reads fenced JSON and ignores junk", () => {
    const parsed = parseRedoAssignments('```json\n{"assignments":[{"seat":"### Neg 2NR (Negative)","instructions":"1. Answer the perm."},{"seat":1}]}\n```');
    expect(parsed.get("Neg 2NR")).toBe("1. Answer the perm.");
    expect(parseRedoAssignments("no json").size).toBe(0);
    expect(fallbackInstructions(seats[0])).toContain("2NR");
  });
});

describe("moves and fiat points", () => {
  it("lets the judge assign drafts and review turned-in redos, and the debater submit", () => {
    expect(availableRedoMoves("draft", "judge")).toContain("assign");
    expect(availableRedoMoves("draft", "student")).toEqual([]);
    expect(availableRedoMoves("assigned", "student")).toEqual(["submit"]);
    expect(availableRedoMoves("submitted", "judge")).toEqual(["review"]);
    expect(availableRedoMoves("reviewed", "student")).toEqual([]);
  });

  it("pays 10 for turning in, 5 for on time, 5 per star", () => {
    expect(fiatPointsFor({ status: "assigned", submittedAt: null, dueAt: null, rating: null })).toBe(0);
    expect(fiatPointsFor({ status: "submitted", submittedAt: 200, dueAt: 100, rating: null })).toBe(10);
    expect(fiatPointsFor({ status: "reviewed", submittedAt: 50, dueAt: 100, rating: 4 })).toBe(35);
  });

  it("awards badges from the redos", () => {
    const summary = fiatSummary([
      { status: "reviewed", submittedAt: 1, dueAt: 2, rating: 5 },
      { status: "submitted", submittedAt: 1, dueAt: null, rating: null },
      { status: "assigned", submittedAt: null, dueAt: null, rating: null },
    ]);
    expect(summary.points).toBe(40 + 15);
    expect(summary.submitted).toBe(2);
    const earned = summary.badges.filter((badge) => badge.earned).map((badge) => badge.id);
    expect(earned).toEqual(["first-redo", "judges-pick"]);
  });
});

describe("validation", () => {
  it("rejects rounds without debater emails and bad reviews", () => {
    expect(parseNewRedoRound({ roundId: "1", format: "policy", debaters: [{ email: "nope", side: "aff", position: 0 }] }).ok).toBe(false);
    expect(parseRedoUpdate({ action: "review", feedback: "Good", rating: 6 }).ok).toBe(false);
    expect(parseRedoUpdate({ action: "edit", timeLimitSeconds: 30 }).ok).toBe(false);
    expect(parseRedoUpdate({ action: "edit", dueInDays: null, judgeInstructions: "Go for the DA" })).toEqual({
      ok: true,
      value: { action: "edit", dueInDays: null, judgeInstructions: "Go for the DA" },
    });
  });
});
