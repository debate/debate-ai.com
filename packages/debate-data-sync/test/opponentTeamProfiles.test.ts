import { beforeEach, describe, expect, it } from "vitest";
import {
  deleteOpponentTeamProfile,
  getOpponentTeamProfile,
  listOpponentTeamProfiles,
  saveOpponentTeamProfile,
} from "../src/state/opponentTeamProfiles";
import { buildOpponentTeamProfile, type OpponentTeamProfile } from "../src/rankings/opponent-team-profile";

/** Minimal in-memory `localStorage` mock — this package's Vitest environment is `node`, with no DOM. */
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

const WXYZ: OpponentTeamProfile = buildOpponentTeamProfile("wxyz", [
  { teamId: "wxyz", tournamentName: "Berkeley", date: "2026-01-01", division: "PF", side: "aff", won: true },
]);

const ABCD: OpponentTeamProfile = buildOpponentTeamProfile("abcd", [
  { teamId: "abcd", tournamentName: "Berkeley", date: "2026-01-01", division: "PF", side: "neg", won: false },
]);

beforeEach(() => {
  (globalThis as unknown as { localStorage: MemoryStorage }).localStorage = new MemoryStorage();
});

describe("listOpponentTeamProfiles", () => {
  it("returns an empty list when nothing is stored", () => {
    expect(listOpponentTeamProfiles()).toEqual([]);
  });

  it("returns an empty list when the stored value is corrupt JSON", () => {
    localStorage.setItem("opponentTeamProfiles", "{not json");
    expect(listOpponentTeamProfiles()).toEqual([]);
  });

  it("returns an empty list when the stored value isn't an array", () => {
    localStorage.setItem("opponentTeamProfiles", JSON.stringify({ not: "an array" }));
    expect(listOpponentTeamProfiles()).toEqual([]);
  });

  it("lists every saved profile", () => {
    saveOpponentTeamProfile(WXYZ);
    saveOpponentTeamProfile(ABCD);
    expect(listOpponentTeamProfiles()).toEqual([WXYZ, ABCD]);
  });
});

describe("getOpponentTeamProfile", () => {
  it("finds a saved profile by teamId", () => {
    saveOpponentTeamProfile(WXYZ);
    expect(getOpponentTeamProfile("wxyz")).toEqual(WXYZ);
  });

  it("returns undefined for a teamId that isn't stored", () => {
    expect(getOpponentTeamProfile("missing")).toBeUndefined();
  });
});

describe("saveOpponentTeamProfile", () => {
  it("upserts — saving an existing teamId overwrites rather than duplicating it", () => {
    saveOpponentTeamProfile(WXYZ);
    const revised = buildOpponentTeamProfile("wxyz", [
      { teamId: "wxyz", tournamentName: "Berkeley", date: "2026-01-01", division: "PF", side: "aff", won: true },
      { teamId: "wxyz", tournamentName: "Berkeley", date: "2026-01-02", division: "PF", side: "neg", won: false },
    ]);
    saveOpponentTeamProfile(revised);

    expect(listOpponentTeamProfiles()).toEqual([revised]);
    expect(getOpponentTeamProfile("wxyz")).toEqual(revised);
  });
});

describe("deleteOpponentTeamProfile", () => {
  it("removes a stored profile by teamId", () => {
    saveOpponentTeamProfile(WXYZ);
    saveOpponentTeamProfile(ABCD);
    deleteOpponentTeamProfile("wxyz");

    expect(listOpponentTeamProfiles()).toEqual([ABCD]);
    expect(getOpponentTeamProfile("wxyz")).toBeUndefined();
  });

  it("is a no-op when the teamId isn't stored", () => {
    saveOpponentTeamProfile(ABCD);
    deleteOpponentTeamProfile("missing");
    expect(listOpponentTeamProfiles()).toEqual([ABCD]);
  });
});
