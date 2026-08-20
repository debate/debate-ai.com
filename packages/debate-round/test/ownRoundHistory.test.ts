import { beforeEach, describe, expect, it } from "vitest";
import {
  deleteOwnRoundHistoryRecord,
  getOwnRoundHistoryAgainst,
  listOwnRoundHistory,
  saveOwnRoundHistoryRecord,
  type OwnRoundHistoryRecord,
} from "../src/state/ownRoundHistory";

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

const WIN_VS_A: OwnRoundHistoryRecord = {
  id: "log-1",
  teamId: "self",
  tournamentName: "Blake",
  date: "2026-01-01",
  division: "LD",
  side: "aff",
  won: true,
  opponentTeamId: "OpponentA",
};

const LOSS_VS_B: OwnRoundHistoryRecord = {
  id: "log-2",
  teamId: "self",
  tournamentName: "Harvard",
  date: "2026-02-01",
  division: "LD",
  side: "neg",
  won: false,
  opponentTeamId: "OpponentB",
};

beforeEach(() => {
  (globalThis as unknown as { localStorage: MemoryStorage }).localStorage = new MemoryStorage();
});

describe("listOwnRoundHistory", () => {
  it("returns an empty list when nothing is stored", () => {
    expect(listOwnRoundHistory()).toEqual([]);
  });

  it("returns an empty list when the stored value is corrupt JSON", () => {
    localStorage.setItem("ownRoundHistory", "{not json");
    expect(listOwnRoundHistory()).toEqual([]);
  });

  it("returns an empty list when the stored value isn't an array", () => {
    localStorage.setItem("ownRoundHistory", JSON.stringify({ not: "an array" }));
    expect(listOwnRoundHistory()).toEqual([]);
  });

  it("lists every saved round in stored order", () => {
    saveOwnRoundHistoryRecord(WIN_VS_A);
    saveOwnRoundHistoryRecord(LOSS_VS_B);
    expect(listOwnRoundHistory()).toEqual([WIN_VS_A, LOSS_VS_B]);
  });
});

describe("saveOwnRoundHistoryRecord", () => {
  it("appends rather than overwriting an existing id", () => {
    saveOwnRoundHistoryRecord(WIN_VS_A);
    saveOwnRoundHistoryRecord(WIN_VS_A);
    expect(listOwnRoundHistory()).toEqual([WIN_VS_A, WIN_VS_A]);
  });
});

describe("deleteOwnRoundHistoryRecord", () => {
  it("removes a stored round by id", () => {
    saveOwnRoundHistoryRecord(WIN_VS_A);
    saveOwnRoundHistoryRecord(LOSS_VS_B);
    deleteOwnRoundHistoryRecord("log-1");

    expect(listOwnRoundHistory()).toEqual([LOSS_VS_B]);
  });

  it("is a no-op when the id isn't stored", () => {
    saveOwnRoundHistoryRecord(WIN_VS_A);
    deleteOwnRoundHistoryRecord("missing");
    expect(listOwnRoundHistory()).toEqual([WIN_VS_A]);
  });
});

describe("getOwnRoundHistoryAgainst", () => {
  it("returns only rounds logged against the given opponent", () => {
    saveOwnRoundHistoryRecord(WIN_VS_A);
    saveOwnRoundHistoryRecord(LOSS_VS_B);
    expect(getOwnRoundHistoryAgainst("OpponentA")).toEqual([WIN_VS_A]);
  });

  it("returns an empty list when no rounds are logged against the opponent", () => {
    saveOwnRoundHistoryRecord(WIN_VS_A);
    expect(getOwnRoundHistoryAgainst("OpponentC")).toEqual([]);
  });

  it("excludes rounds that never tracked an opponentTeamId", () => {
    saveOwnRoundHistoryRecord({ ...WIN_VS_A, id: "log-3", opponentTeamId: undefined });
    expect(getOwnRoundHistoryAgainst("OpponentA")).toEqual([]);
  });
});
