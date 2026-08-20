import { beforeEach, describe, expect, it } from "vitest";
import {
  deleteOpponentRoundRecord,
  listOpponentRoundRecords,
  listOpponentRoundRecordsForTeam,
  rebuildOpponentTeamProfileFromRecords,
  recordOpponentRound,
  updateOpponentRoundRecord,
  type OpponentRoundRecordEntry,
} from "../src/state/opponentRoundRecords";
import {
  getOpponentTeamProfile,
  saveOpponentTeamProfile,
} from "../src/state/opponentTeamProfiles";
import { buildOpponentTeamProfile } from "../src/rankings/opponent-team-profile";

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

function entry(overrides: Partial<OpponentRoundRecordEntry> = {}): OpponentRoundRecordEntry {
  return {
    id: "r1",
    teamId: "wxyz",
    tournamentName: "Berkeley",
    date: "2026-01-01",
    division: "PF",
    side: "aff",
    won: true,
    ...overrides,
  };
}

beforeEach(() => {
  (globalThis as unknown as { localStorage: MemoryStorage }).localStorage = new MemoryStorage();
});

describe("recordOpponentRound", () => {
  it("persists the round and derives the team's profile", () => {
    const profile = recordOpponentRound(entry());

    expect(listOpponentRoundRecords()).toHaveLength(1);
    expect(profile.roundsRecorded).toBe(1);
    expect(getOpponentTeamProfile("wxyz")).toEqual(profile);
  });

  it("re-aggregates record, tournaments, and side split across every logged round", () => {
    recordOpponentRound(entry({ id: "r1", side: "aff", won: true }));
    const profile = recordOpponentRound(
      entry({ id: "r2", tournamentName: "Glenbrooks", side: "neg", won: false }),
    );

    expect(profile.roundsRecorded).toBe(2);
    expect(profile.tournamentsAttended).toBe(2);
    expect(profile.record).toMatchObject({ wins: 1, losses: 1, winRate: 0.5 });
    expect(profile.sideRecord.aff).toMatchObject({ rounds: 1, wins: 1 });
    expect(profile.sideRecord.neg).toMatchObject({ rounds: 1, wins: 0 });
    expect(getOpponentTeamProfile("wxyz")?.roundsRecorded).toBe(2);
  });

  it("re-ranks argument tags and cases across every logged round", () => {
    recordOpponentRound(entry({ id: "r1", argumentTags: ["kritik"], caseName: "Warming" }));
    const profile = recordOpponentRound(
      entry({ id: "r2", argumentTags: ["kritik", "topicality"], caseName: "Warming" }),
    );

    expect(profile.topArgumentTags).toEqual([
      { value: "kritik", count: 2 },
      { value: "topicality", count: 1 },
    ]);
    expect(profile.topCases).toEqual([{ value: "Warming", count: 2 }]);
  });

  it("keeps each team's rounds and profile separate", () => {
    recordOpponentRound(entry({ id: "r1", teamId: "wxyz", won: true }));
    recordOpponentRound(entry({ id: "r2", teamId: "abcd", won: false }));

    expect(listOpponentRoundRecordsForTeam("wxyz")).toHaveLength(1);
    expect(getOpponentTeamProfile("wxyz")?.record.wins).toBe(1);
    expect(getOpponentTeamProfile("abcd")?.record.losses).toBe(1);
  });
});

describe("rebuildOpponentTeamProfileFromRecords", () => {
  it("matches building the profile straight from the logged records", () => {
    const first = entry({ id: "r1" });
    const second = entry({ id: "r2", side: "neg", won: false, argumentTags: ["kritik"] });
    recordOpponentRound(first);
    recordOpponentRound(second);

    expect(rebuildOpponentTeamProfileFromRecords("wxyz")).toEqual(
      buildOpponentTeamProfile("wxyz", [first, second]),
    );
  });

  it("deletes a team's derived profile when no rounds remain", () => {
    saveOpponentTeamProfile(buildOpponentTeamProfile("wxyz", [entry()]));

    expect(rebuildOpponentTeamProfileFromRecords("wxyz")).toBeNull();
    expect(getOpponentTeamProfile("wxyz")).toBeUndefined();
  });
});

describe("updateOpponentRoundRecord", () => {
  it("replaces the round in place and re-aggregates the team's profile", () => {
    recordOpponentRound(entry({ id: "r1", side: "aff", won: true }));
    recordOpponentRound(entry({ id: "r2", side: "aff", won: true }));

    const profile = updateOpponentRoundRecord(entry({ id: "r1", side: "neg", won: false }));

    expect(listOpponentRoundRecords().map((record) => record.id)).toEqual(["r1", "r2"]);
    expect(profile?.roundsRecorded).toBe(2);
    expect(profile?.record).toMatchObject({ wins: 1, losses: 1 });
    expect(getOpponentTeamProfile("wxyz")?.sideRecord.neg.rounds).toBe(1);
  });

  it("matches re-recording the corrected round from scratch", () => {
    const corrected = entry({ id: "r1", side: "neg", won: false, caseName: "Warming" });
    recordOpponentRound(entry({ id: "r1", side: "aff", won: true, caseName: "Trade" }));

    expect(updateOpponentRoundRecord(corrected)).toEqual(
      buildOpponentTeamProfile("wxyz", [corrected]),
    );
  });

  it("re-aggregates both teams when a round is reassigned", () => {
    recordOpponentRound(entry({ id: "r1", teamId: "wxyz" }));
    recordOpponentRound(entry({ id: "r2", teamId: "wxyz" }));

    const profile = updateOpponentRoundRecord(entry({ id: "r2", teamId: "abcd" }));

    expect(profile?.teamId).toBe("abcd");
    expect(getOpponentTeamProfile("wxyz")?.roundsRecorded).toBe(1);
    expect(getOpponentTeamProfile("abcd")?.roundsRecorded).toBe(1);
  });

  it("deletes the previous team's profile when the reassigned round was its last", () => {
    recordOpponentRound(entry({ id: "r1", teamId: "wxyz" }));

    updateOpponentRoundRecord(entry({ id: "r1", teamId: "abcd" }));

    expect(getOpponentTeamProfile("wxyz")).toBeUndefined();
    expect(getOpponentTeamProfile("abcd")?.roundsRecorded).toBe(1);
  });

  it("is a no-op returning null for an unknown id", () => {
    const profile = recordOpponentRound(entry({ id: "r1" }));

    expect(updateOpponentRoundRecord(entry({ id: "does-not-exist", won: false }))).toBeNull();
    expect(listOpponentRoundRecords()).toHaveLength(1);
    expect(getOpponentTeamProfile("wxyz")).toEqual(profile);
  });
});

describe("deleteOpponentRoundRecord", () => {
  it("removes the round and re-aggregates the team's profile", () => {
    recordOpponentRound(entry({ id: "r1", won: true }));
    recordOpponentRound(entry({ id: "r2", side: "neg", won: false }));

    deleteOpponentRoundRecord("r2");

    expect(listOpponentRoundRecordsForTeam("wxyz")).toHaveLength(1);
    expect(getOpponentTeamProfile("wxyz")?.roundsRecorded).toBe(1);
    expect(getOpponentTeamProfile("wxyz")?.sideRecord.neg.rounds).toBe(0);
  });

  it("deletes the derived profile once the team's last round is removed", () => {
    recordOpponentRound(entry({ id: "r1" }));

    deleteOpponentRoundRecord("r1");

    expect(listOpponentRoundRecords()).toEqual([]);
    expect(getOpponentTeamProfile("wxyz")).toBeUndefined();
  });

  it("is a no-op for an unknown id, leaving the profile untouched", () => {
    const profile = recordOpponentRound(entry({ id: "r1" }));

    deleteOpponentRoundRecord("does-not-exist");

    expect(listOpponentRoundRecords()).toHaveLength(1);
    expect(getOpponentTeamProfile("wxyz")).toEqual(profile);
  });

  it("leaves another team's profile untouched", () => {
    recordOpponentRound(entry({ id: "r1", teamId: "wxyz" }));
    const other = recordOpponentRound(entry({ id: "r2", teamId: "abcd" }));

    deleteOpponentRoundRecord("r1");

    expect(getOpponentTeamProfile("wxyz")).toBeUndefined();
    expect(getOpponentTeamProfile("abcd")).toEqual(other);
  });
});

describe("storage resilience", () => {
  it("degrades to an empty list when the stored JSON is corrupt", () => {
    localStorage.setItem("opponentRoundRecords", "{not json");

    expect(listOpponentRoundRecords()).toEqual([]);
  });

  it("degrades to an empty list when the stored value isn't an array", () => {
    localStorage.setItem("opponentRoundRecords", JSON.stringify({ wxyz: [] }));

    expect(listOpponentRoundRecords()).toEqual([]);
  });
});
