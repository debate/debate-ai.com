import { describe, expect, it } from "vitest";
import { isValidRoundPairingRecord } from "../src/state/savedRoundPairings";
import type { RoundPairingRecord } from "../src/state/roundPairings";

function makeRecord(overrides: Partial<RoundPairingRecord> = {}): RoundPairingRecord {
  return {
    roundId: "round-1",
    tournamentName: "Blake",
    division: "LD",
    roundLabel: "Round 4",
    side: "aff",
    ...overrides,
  };
}

describe("isValidRoundPairingRecord", () => {
  it("accepts a well-formed record with only required fields", () => {
    expect(isValidRoundPairingRecord(makeRecord())).toBe(true);
  });

  it("accepts a record with every optional field present", () => {
    expect(
      isValidRoundPairingRecord(
        makeRecord({
          room: "Room 204",
          opponentLabel: "Greenhill AB",
          judgeLabel: "J. Smith",
          updatedAt: 1700000000000,
        }),
      ),
    ).toBe(true);
  });

  it.each([null, undefined, "record", 42, [], true])("rejects a non-object value %p", (value) => {
    expect(isValidRoundPairingRecord(value)).toBe(false);
  });

  it("rejects a record with a non-string roundId", () => {
    expect(isValidRoundPairingRecord(makeRecord({ roundId: 5 as unknown as string }))).toBe(false);
  });

  it("rejects a record with an empty/whitespace-only roundId", () => {
    expect(isValidRoundPairingRecord(makeRecord({ roundId: "   " }))).toBe(false);
  });

  it.each(["tournamentName", "division", "roundLabel"] as const)(
    "rejects a record with an empty/whitespace-only %s",
    (field) => {
      expect(isValidRoundPairingRecord(makeRecord({ [field]: "   " }))).toBe(false);
    },
  );

  it("rejects a record whose side isn't 'aff' or 'neg'", () => {
    expect(
      isValidRoundPairingRecord(makeRecord({ side: "affirmative" as unknown as RoundPairingRecord["side"] })),
    ).toBe(false);
  });

  it.each(["room", "opponentLabel", "judgeLabel"] as const)(
    "rejects a record whose %s is present but empty/whitespace-only",
    (field) => {
      expect(isValidRoundPairingRecord(makeRecord({ [field]: "   " }))).toBe(false);
    },
  );

  it.each(["room", "opponentLabel", "judgeLabel"] as const)(
    "rejects a record whose %s is a non-string",
    (field) => {
      expect(isValidRoundPairingRecord(makeRecord({ [field]: 5 as unknown as string }))).toBe(false);
    },
  );

  it("rejects a record whose updatedAt is present but not a number", () => {
    expect(
      isValidRoundPairingRecord(makeRecord({ updatedAt: "yesterday" as unknown as number })),
    ).toBe(false);
  });
});
