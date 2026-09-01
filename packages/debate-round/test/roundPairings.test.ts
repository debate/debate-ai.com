import { beforeEach, describe, expect, it } from "vitest";
import {
  adoptRoundPairing,
  buildRoundPairingRecordFromDraft,
  buildRoundPairingsPanelView,
  deleteRoundPairing,
  getRoundPairing,
  listRoundPairings,
  saveRoundPairing,
  type RoundPairingDraft,
  type RoundPairingRecord,
} from "../src/state/roundPairings";

/** Minimal in-memory `localStorage` mock — this package's Vitest environment has no DOM by default here. */
class MemoryStorage {
  private store = new Map<string, string>();
  getItem(key: string): string | null {
    return this.store.has(key) ? this.store.get(key)! : null;
  }
  setItem(key: string, value: string): void {
    this.store.set(key, value);
  }
  removeItem(key: string): void {
    this.store.delete(key);
  }
  clear(): void {
    this.store.clear();
  }
}

const NOW = Date.UTC(2026, 0, 1);

const PAIRING_A: RoundPairingRecord = {
  roundId: "round-1",
  tournamentName: "Blake",
  division: "LD",
  roundLabel: "Round 4",
  side: "aff",
  room: "Room 204",
  opponentLabel: "Greenhill AB",
  judgeLabel: "J. Smith",
};
const PAIRING_B: RoundPairingRecord = {
  roundId: "round-2",
  tournamentName: "Greenhill",
  division: "PF",
  roundLabel: "Round 1",
  side: "neg",
};

beforeEach(() => {
  (globalThis as unknown as { localStorage: MemoryStorage }).localStorage = new MemoryStorage();
});

describe("listRoundPairings", () => {
  it("returns an empty list when nothing is stored", () => {
    expect(listRoundPairings()).toEqual([]);
  });

  it("returns an empty list when the stored value is corrupt JSON", () => {
    localStorage.setItem("roundPairings", "{not json");
    expect(listRoundPairings()).toEqual([]);
  });

  it("returns an empty list when the stored value isn't an array", () => {
    localStorage.setItem("roundPairings", JSON.stringify({ not: "an array" }));
    expect(listRoundPairings()).toEqual([]);
  });

  it("lists every saved pairing", () => {
    saveRoundPairing(PAIRING_A, NOW);
    saveRoundPairing(PAIRING_B, NOW);
    expect(listRoundPairings()).toEqual([
      { ...PAIRING_A, updatedAt: NOW },
      { ...PAIRING_B, updatedAt: NOW },
    ]);
  });
});

describe("getRoundPairing", () => {
  it("finds a saved pairing by roundId", () => {
    saveRoundPairing(PAIRING_A, NOW);
    expect(getRoundPairing("round-1")).toEqual({ ...PAIRING_A, updatedAt: NOW });
  });

  it("returns undefined for a roundId that isn't stored", () => {
    expect(getRoundPairing("missing")).toBeUndefined();
  });
});

describe("saveRoundPairing", () => {
  it("upserts — saving an existing roundId overwrites rather than duplicating it", () => {
    saveRoundPairing(PAIRING_A, NOW);
    const updated: RoundPairingRecord = { ...PAIRING_A, room: "Room 310" };
    const laterNow = NOW + 60_000;
    saveRoundPairing(updated, laterNow);

    expect(listRoundPairings()).toEqual([{ ...updated, updatedAt: laterNow }]);
    expect(getRoundPairing("round-1")).toEqual({ ...updated, updatedAt: laterNow });
  });

  it("stamps updatedAt with the current time by default", () => {
    const before = Date.now();
    saveRoundPairing(PAIRING_A);
    const after = Date.now();

    const stored = getRoundPairing("round-1");
    expect(stored?.updatedAt).toBeGreaterThanOrEqual(before);
    expect(stored?.updatedAt).toBeLessThanOrEqual(after);
  });

  it("ignores any updatedAt already present on the passed-in record", () => {
    saveRoundPairing({ ...PAIRING_A, updatedAt: 1 }, NOW);
    expect(getRoundPairing("round-1")?.updatedAt).toBe(NOW);
  });
});

describe("adoptRoundPairing", () => {
  it("inserts a new pairing as-is, preserving its own updatedAt", () => {
    adoptRoundPairing({ ...PAIRING_A, updatedAt: 42 });
    expect(getRoundPairing("round-1")).toEqual({ ...PAIRING_A, updatedAt: 42 });
  });

  it("overwrites an existing pairing for the same roundId", () => {
    saveRoundPairing(PAIRING_A, NOW);
    adoptRoundPairing({ ...PAIRING_A, room: "Room 999", updatedAt: 42 });
    expect(getRoundPairing("round-1")).toEqual({ ...PAIRING_A, room: "Room 999", updatedAt: 42 });
  });
});

describe("deleteRoundPairing", () => {
  it("removes a stored pairing by roundId", () => {
    saveRoundPairing(PAIRING_A, NOW);
    saveRoundPairing(PAIRING_B, NOW);
    deleteRoundPairing("round-1");

    expect(listRoundPairings()).toEqual([{ ...PAIRING_B, updatedAt: NOW }]);
    expect(getRoundPairing("round-1")).toBeUndefined();
  });

  it("is a no-op when the roundId isn't stored", () => {
    saveRoundPairing(PAIRING_B, NOW);
    deleteRoundPairing("missing");
    expect(listRoundPairings()).toEqual([{ ...PAIRING_B, updatedAt: NOW }]);
  });
});

describe("buildRoundPairingsPanelView", () => {
  it("returns an empty list when nothing is stored", () => {
    expect(buildRoundPairingsPanelView()).toEqual([]);
  });

  it("sorts every persisted pairing by roundId", () => {
    saveRoundPairing(PAIRING_B, NOW);
    saveRoundPairing(PAIRING_A, NOW);
    expect(buildRoundPairingsPanelView()).toEqual([
      { ...PAIRING_A, updatedAt: NOW },
      { ...PAIRING_B, updatedAt: NOW },
    ]);
  });

  it("does not mutate the underlying stored order", () => {
    saveRoundPairing(PAIRING_B, NOW);
    saveRoundPairing(PAIRING_A, NOW);
    buildRoundPairingsPanelView();
    expect(listRoundPairings()).toEqual([
      { ...PAIRING_B, updatedAt: NOW },
      { ...PAIRING_A, updatedAt: NOW },
    ]);
  });
});

const VALID_DRAFT: RoundPairingDraft = {
  roundId: "round-9",
  tournamentName: "Blake",
  division: "LD",
  roundLabel: "Round 4",
  side: "aff",
};

describe("buildRoundPairingRecordFromDraft", () => {
  it("composes a valid record from the minimal required fields", () => {
    const result = buildRoundPairingRecordFromDraft(VALID_DRAFT);

    expect(result).toEqual({
      ok: true,
      record: {
        roundId: "round-9",
        tournamentName: "Blake",
        division: "LD",
        roundLabel: "Round 4",
        side: "aff",
      },
    });
  });

  it("trims whitespace-only required fields and reports a validation error", () => {
    const result = buildRoundPairingRecordFromDraft({ ...VALID_DRAFT, roundId: "   " });

    expect(result).toEqual({
      ok: false,
      error: "Round ID, tournament, division, and round label are all required.",
    });
  });

  it("reports a validation error when any required field is missing", () => {
    expect(buildRoundPairingRecordFromDraft({ ...VALID_DRAFT, tournamentName: "" }).ok).toBe(false);
    expect(buildRoundPairingRecordFromDraft({ ...VALID_DRAFT, division: "" }).ok).toBe(false);
    expect(buildRoundPairingRecordFromDraft({ ...VALID_DRAFT, roundLabel: "" }).ok).toBe(false);
  });

  it("trims and includes optional room, opponent label, and judge label when supplied", () => {
    const result = buildRoundPairingRecordFromDraft({
      ...VALID_DRAFT,
      room: "  Room 204  ",
      opponentLabel: "  Greenhill AB  ",
      judgeLabel: "  J. Smith  ",
    });

    expect(result).toEqual({
      ok: true,
      record: {
        roundId: "round-9",
        tournamentName: "Blake",
        division: "LD",
        roundLabel: "Round 4",
        side: "aff",
        room: "Room 204",
        opponentLabel: "Greenhill AB",
        judgeLabel: "J. Smith",
      },
    });
  });

  it("omits optional fields that are blank/whitespace-only", () => {
    const result = buildRoundPairingRecordFromDraft({ ...VALID_DRAFT, room: "   ", opponentLabel: "" });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected ok result");
    expect(result.record.room).toBeUndefined();
    expect(result.record.opponentLabel).toBeUndefined();
  });
});
