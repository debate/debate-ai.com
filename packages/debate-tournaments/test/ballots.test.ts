/**
 * Pins the judge ballot rules shared by the Ballot tab, the host's API and
 * the `submit_judge_ballot` tool: what a complete ballot is, and that the
 * Tabroom account email has to match the signed-in email.
 */
import { describe, expect, it } from "vitest";
import { SUBMIT_JUDGE_BALLOT_TOOL, emailsMatch, validateJudgeBallot } from "../src/ballots";

const ballot = {
  tournId: 38436,
  event: "VCX",
  round: "3",
  aff: "Lexington AB",
  neg: "Bronx CD",
  winner: "neg",
  tabroomEmail: "Judge@Example.com ",
  destination: "local",
};

describe("emailsMatch", () => {
  it("ignores case and surrounding space", () => {
    expect(emailsMatch(" Judge@Example.COM", "judge@example.com")).toBe(true);
  });
  it.each([
    ["judge@example.com", "other@example.com"],
    ["", ""],
    [null, null],
    ["not-an-email", "not-an-email"],
  ])("%j vs %j does not match", (a, b) => {
    expect(emailsMatch(a, b)).toBe(false);
  });
});

describe("validateJudgeBallot", () => {
  it("accepts a complete ballot and normalises it", () => {
    const result = validateJudgeBallot({ ...ballot, room: "  ", rfd: " Neg won the K. " });
    expect(result).toEqual({
      ok: true,
      ballot: {
        tournId: 38436,
        event: "VCX",
        round: "3",
        aff: "Lexington AB",
        neg: "Bronx CD",
        winner: "neg",
        rfd: "Neg won the K.",
        tabroomEmail: "judge@example.com",
        destination: "local",
      },
    });
  });

  it("defaults the destination to local", () => {
    const { destination: _, ...rest } = ballot;
    const result = validateJudgeBallot(rest);
    expect(result.ok && result.ballot.destination).toBe("local");
  });

  it("keeps speaker points", () => {
    const result = validateJudgeBallot({ ...ballot, speakerPoints: [{ speaker: "A", side: "aff", points: "28.5" }] });
    expect(result.ok && result.ballot.speakerPoints).toEqual([{ speaker: "A", side: "aff", points: 28.5 }]);
  });

  it("lists every problem", () => {
    const result = validateJudgeBallot({
      tournId: "x",
      aff: "Same",
      neg: "same",
      winner: "tie",
      tabroomEmail: "nope",
      destination: "email",
      speakerPoints: [{ speaker: "", side: "pro", points: 300 }],
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors).toEqual([
      "tournId must be a positive whole number.",
      "event is required.",
      "round is required.",
      "aff and neg must be different entries.",
      'winner must be "aff" or "neg".',
      'destination must be "local" or "tabroom".',
      "tabroomEmail must be the email of your Tabroom account.",
      "speakerPoints[0].speaker is required.",
      'speakerPoints[0].side must be "aff" or "neg".',
      "speakerPoints[0].points must be between 0 and 100.",
    ]);
  });

  it("rejects a non-object", () => {
    expect(validateJudgeBallot(null).ok).toBe(false);
  });
});

describe("SUBMIT_JUDGE_BALLOT_TOOL", () => {
  it("requires exactly what validation requires", () => {
    const { tournId, event, round, aff, neg, winner, tabroomEmail } = ballot;
    const minimal = { tournId, event, round, aff, neg, winner, tabroomEmail };
    expect(Object.keys(minimal).sort()).toEqual([...SUBMIT_JUDGE_BALLOT_TOOL.input_schema.required].sort());
    expect(validateJudgeBallot(minimal).ok).toBe(true);
    for (const key of SUBMIT_JUDGE_BALLOT_TOOL.input_schema.required) {
      const { [key]: _, ...missing } = minimal;
      expect(validateJudgeBallot(missing).ok).toBe(false);
    }
  });
});
