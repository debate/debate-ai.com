import { describe, expect, it } from "vitest";
import { isValidTournamentResultRecord } from "../src/state/savedTournamentResults";
import type { TournamentResultRecord } from "../src/state/tournamentResults";

function makeRecord(overrides: Partial<TournamentResultRecord> = {}): TournamentResultRecord {
  return {
    id: "team-1-example-2026-01-01-1",
    teamId: "team-1",
    tournamentName: "Example Invitational",
    date: "2026-01-01",
    division: "PF",
    bidLevel: 1,
    finish: "quarterfinalist",
    prelimWins: 4,
    prelimLosses: 2,
    ...overrides,
  };
}

describe("isValidTournamentResultRecord", () => {
  it("accepts a well-formed record", () => {
    expect(isValidTournamentResultRecord(makeRecord())).toBe(true);
  });

  it("accepts every known outround finish", () => {
    const finishes: TournamentResultRecord["finish"][] = [
      "champion",
      "finalist",
      "semifinalist",
      "quarterfinalist",
      "octofinalist",
      "doubleOctofinalist",
      "tripleOctofinalist",
      "prelims",
    ];
    for (const finish of finishes) {
      expect(isValidTournamentResultRecord(makeRecord({ finish }))).toBe(true);
    }
  });

  it("accepts zero bid level/prelim record", () => {
    expect(isValidTournamentResultRecord(makeRecord({ bidLevel: 0, prelimWins: 0, prelimLosses: 0 }))).toBe(true);
  });

  it.each([null, undefined, "record", 42, [], true])("rejects a non-object value %p", (value) => {
    expect(isValidTournamentResultRecord(value)).toBe(false);
  });

  it.each(["id", "teamId", "tournamentName", "date", "division"] as const)(
    "rejects a record with a non-string/empty %p",
    (field) => {
      expect(isValidTournamentResultRecord(makeRecord({ [field]: "" } as never))).toBe(false);
      expect(isValidTournamentResultRecord(makeRecord({ [field]: 5 } as never))).toBe(false);
    },
  );

  it("rejects a record whose finish isn't a known outround finish", () => {
    expect(isValidTournamentResultRecord(makeRecord({ finish: "grand champion" as never }))).toBe(false);
  });

  it.each(["bidLevel", "prelimWins", "prelimLosses"] as const)(
    "rejects a record whose %p is negative",
    (field) => {
      expect(isValidTournamentResultRecord(makeRecord({ [field]: -1 } as never))).toBe(false);
    },
  );

  it.each(["bidLevel", "prelimWins", "prelimLosses"] as const)(
    "rejects a record whose %p isn't an integer",
    (field) => {
      expect(isValidTournamentResultRecord(makeRecord({ [field]: 1.5 } as never))).toBe(false);
      expect(isValidTournamentResultRecord(makeRecord({ [field]: "3" } as never))).toBe(false);
    },
  );
});
