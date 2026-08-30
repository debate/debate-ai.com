import { describe, expect, it } from "vitest";
import { deriveRoundLabel, isValidRound } from "../src/state/savedRounds";
import type { Round } from "../src/types/flow";

function makeRound(overrides: Partial<Round> = {}): Round {
  return {
    id: 1700000000000,
    tournamentName: "Glenbrooks",
    roundLevel: "Octafinals",
    debaters: { aff: ["a@b.com", ""], neg: ["c@d.com", ""] },
    judges: ["judge@e.com"],
    flowIds: [1, 2],
    timestamp: 1700000000000,
    status: "completed",
    ...overrides,
  };
}

describe("isValidRound", () => {
  it("accepts a well-formed round with only required fields", () => {
    expect(isValidRound(makeRound())).toBe(true);
  });

  it("accepts optional fields (schools, spectators, isPrivate, winner, title, slug) when present", () => {
    const round = makeRound({
      schools: { aff: ["Lynbrook", ""], neg: ["Monta Vista", ""] },
      spectators: ["spec@e.com"],
      isPrivate: true,
      winner: "aff",
      title: "2025 Glenbrooks - Octos - Lynbrook BZ vs Monta Vista EY",
      slug: "2025-glenbrooks/lynbrook-bz-monta-ey",
    });
    expect(isValidRound(round)).toBe(true);
  });

  it.each([null, undefined, "round", 42, [], true])("rejects a non-object value %p", (value) => {
    expect(isValidRound(value)).toBe(false);
  });

  it.each([
    "id",
    "tournamentName",
    "roundLevel",
    "debaters",
    "judges",
    "flowIds",
    "timestamp",
    "status",
  ] as const)("rejects a round missing required field %p", (field) => {
    const round = makeRound() as unknown as Record<string, unknown>;
    delete round[field];
    expect(isValidRound(round)).toBe(false);
  });

  it("rejects a round whose status is not a known value", () => {
    expect(isValidRound(makeRound({ status: "archived" as unknown as Round["status"] }))).toBe(false);
  });

  it("rejects a round whose debaters.aff is not a pair of strings", () => {
    const round = makeRound() as unknown as { debaters: { aff: unknown } };
    round.debaters.aff = ["only-one"];
    expect(isValidRound(round)).toBe(false);
  });

  it("rejects a round whose debaters.neg contains a non-string", () => {
    const round = makeRound() as unknown as { debaters: { neg: unknown } };
    round.debaters.neg = ["a@b.com", 2];
    expect(isValidRound(round)).toBe(false);
  });

  it("rejects a round whose judges array contains a non-string", () => {
    expect(isValidRound(makeRound({ judges: ["a@b.com", 2 as unknown as string] }))).toBe(false);
  });

  it("rejects a round whose flowIds array contains a non-number", () => {
    expect(isValidRound(makeRound({ flowIds: [1, "2" as unknown as number] }))).toBe(false);
  });

  it("rejects a round whose schools field is malformed", () => {
    const round = makeRound({ schools: { aff: ["Lynbrook", ""], neg: ["Monta Vista", ""] } }) as unknown as {
      schools: { neg: unknown };
    };
    round.schools.neg = ["only-one"];
    expect(isValidRound(round)).toBe(false);
  });

  it("rejects a round whose spectators array contains a non-string", () => {
    expect(isValidRound(makeRound({ spectators: ["a@b.com", 2 as unknown as string] }))).toBe(false);
  });

  it("rejects a round whose isPrivate is not a boolean", () => {
    expect(isValidRound(makeRound({ isPrivate: "yes" as unknown as boolean }))).toBe(false);
  });

  it("rejects a round whose winner is not a known value", () => {
    expect(isValidRound(makeRound({ winner: "tie" as unknown as Round["winner"] }))).toBe(false);
  });

  it("rejects a round whose title is not a string", () => {
    expect(isValidRound(makeRound({ title: 42 as unknown as string }))).toBe(false);
  });

  it("rejects a round whose slug is not a string", () => {
    expect(isValidRound(makeRound({ slug: 42 as unknown as string }))).toBe(false);
  });
});

describe("deriveRoundLabel", () => {
  it("uses the round's formatted title when present", () => {
    const label = deriveRoundLabel({
      title: "2025 Glenbrooks - Octos - Lynbrook BZ vs Monta Vista EY",
      tournamentName: "Glenbrooks",
      roundLevel: "Octafinals",
    });
    expect(label).toBe("2025 Glenbrooks - Octos - Lynbrook BZ vs Monta Vista EY");
  });

  it("trims the title before using it", () => {
    const label = deriveRoundLabel({ title: "  Finals Round  ", tournamentName: "T", roundLevel: "Finals" });
    expect(label).toBe("Finals Round");
  });

  it("falls back to tournament + round level when title is absent", () => {
    const label = deriveRoundLabel({ title: undefined, tournamentName: "Glenbrooks", roundLevel: "Octafinals" });
    expect(label).toBe("Glenbrooks - Octafinals");
  });

  it("falls back to tournament + round level when title is only whitespace", () => {
    const label = deriveRoundLabel({ title: "   ", tournamentName: "Glenbrooks", roundLevel: "Quarterfinals" });
    expect(label).toBe("Glenbrooks - Quarterfinals");
  });

  it("truncates a very long label to 120 characters", () => {
    const long = "x".repeat(200);
    const label = deriveRoundLabel({ title: long, tournamentName: "T", roundLevel: "R" });
    expect(label).toHaveLength(120);
    expect(label).toBe("x".repeat(120));
  });
});
