import { describe, expect, it } from "vitest";
import {
  deriveRoundLabel,
  hasRoundSaveConflict,
  isValidRound,
  planSavedRoundFlowRemoval,
  readSavedRoundFlowIds,
} from "../src/state/savedRounds";
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

describe("hasRoundSaveConflict", () => {
  it("never conflicts when no saved row exists yet, regardless of baseUpdatedAt", () => {
    expect(hasRoundSaveConflict(null, null)).toBe(false);
    expect(hasRoundSaveConflict(null, undefined)).toBe(false);
    expect(hasRoundSaveConflict(null, "2024-01-01T00:00:00.000Z")).toBe(false);
  });

  it("does not conflict when baseUpdatedAt matches the saved row's updatedAt", () => {
    expect(hasRoundSaveConflict("2024-01-01T00:00:00.000Z", "2024-01-01T00:00:00.000Z")).toBe(false);
  });

  it("conflicts when baseUpdatedAt is older than the saved row's updatedAt", () => {
    expect(hasRoundSaveConflict("2024-01-02T00:00:00.000Z", "2024-01-01T00:00:00.000Z")).toBe(true);
  });

  it("conflicts when a row exists but the caller has no baseline (null or undefined)", () => {
    expect(hasRoundSaveConflict("2024-01-01T00:00:00.000Z", null)).toBe(true);
    expect(hasRoundSaveConflict("2024-01-01T00:00:00.000Z", undefined)).toBe(true);
  });
});

describe("readSavedRoundFlowIds", () => {
  it("reads a round's integer flow ids, once each, in order", () => {
    expect(readSavedRoundFlowIds(makeRound({ flowIds: [3, 1, 3, 2] }))).toEqual([3, 1, 2]);
  });

  it("drops non-integer ids and reads flowIds from a row that isn't a valid round", () => {
    expect(readSavedRoundFlowIds({ flowIds: [1, "2", 2.5, null, 4] })).toEqual([1, 4]);
  });

  it("answers [] for anything without a flowIds array", () => {
    for (const value of [null, undefined, 5, "x", [], {}, { flowIds: "1,2" }]) {
      expect(readSavedRoundFlowIds(value)).toEqual([]);
    }
  });
});

describe("planSavedRoundFlowRemoval", () => {
  it("removes every flow when no other round uses them", () => {
    expect(planSavedRoundFlowRemoval([1, 2], [])).toEqual({ remove: [1, 2], kept: [] });
  });

  it("keeps a flow another saved round points at", () => {
    expect(planSavedRoundFlowRemoval([1, 2, 3], [[9], [2, 8], [3]])).toEqual({ remove: [1], kept: [2, 3] });
  });

  it("drops repeats and never mutates its inputs", () => {
    const round = [1, 1, 2];
    const others = [[2]];
    expect(planSavedRoundFlowRemoval(round, others)).toEqual({ remove: [1], kept: [2] });
    expect(round).toEqual([1, 1, 2]);
    expect(others).toEqual([[2]]);
  });

  it("answers empty lists for a round with no flows", () => {
    expect(planSavedRoundFlowRemoval([], [[1]])).toEqual({ remove: [], kept: [] });
  });
});
