import { beforeEach, describe, expect, it } from "vitest";
import {
  deleteJudgeRoundRecord,
  findNearestJudgeId,
  listJudgeIds,
  listJudgeRoundRecords,
  listJudgeRoundRecordsForJudge,
  rebuildJudgeProfileFromRecords,
  recordJudgeRound,
  updateJudgeRoundRecord,
  type JudgeRoundRecordEntry,
} from "../src/state/judgeRoundRecords";
import { getJudgeProfile, saveJudgeProfile } from "../src/state/judgeProfiles";
import { buildJudgeProfile } from "../src/judge/judge-profile";

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

function entry(overrides: Partial<JudgeRoundRecordEntry> = {}): JudgeRoundRecordEntry {
  return {
    id: "r1",
    judgeId: "smith",
    tournamentName: "Berkeley",
    date: "2026-01-01",
    division: "PF",
    winningSide: "aff",
    affSpeakerPoints: 28,
    negSpeakerPoints: 27,
    theoryArgumentRaised: false,
    theoryArgumentWon: false,
    ...overrides,
  };
}

beforeEach(() => {
  (globalThis as unknown as { localStorage: MemoryStorage }).localStorage = new MemoryStorage();
});

describe("recordJudgeRound", () => {
  it("persists the round and derives the judge's profile", () => {
    const profile = recordJudgeRound(entry());

    expect(listJudgeRoundRecords()).toHaveLength(1);
    expect(profile.roundsJudged).toBe(1);
    expect(getJudgeProfile("smith")).toEqual(profile);
  });

  it("re-aggregates across every round logged for the judge", () => {
    recordJudgeRound(entry({ id: "r1", winningSide: "aff", paceWpm: 320 }));
    const profile = recordJudgeRound(
      entry({ id: "r2", tournamentName: "Glenbrooks", winningSide: "neg", paceWpm: 280 }),
    );

    expect(profile.roundsJudged).toBe(2);
    expect(profile.tournamentsJudged).toBe(2);
    expect(profile.sideBias).toMatchObject({ affWins: 1, negWins: 1 });
    expect(profile.avgPaceWpm).toBe(300);
    expect(getJudgeProfile("smith")?.roundsJudged).toBe(2);
  });

  it("keeps each judge's rounds and profile separate", () => {
    recordJudgeRound(entry({ id: "r1", judgeId: "smith" }));
    recordJudgeRound(entry({ id: "r2", judgeId: "jones", winningSide: "neg" }));

    expect(listJudgeRoundRecordsForJudge("smith")).toHaveLength(1);
    expect(getJudgeProfile("smith")?.sideBias.affWins).toBe(1);
    expect(getJudgeProfile("jones")?.sideBias.negWins).toBe(1);
  });
});

describe("rebuildJudgeProfileFromRecords", () => {
  it("matches building the profile straight from the logged records", () => {
    const first = entry({ id: "r1" });
    const second = entry({ id: "r2", winningSide: "neg", theoryArgumentRaised: true });
    recordJudgeRound(first);
    recordJudgeRound(second);

    expect(rebuildJudgeProfileFromRecords("smith")).toEqual(
      buildJudgeProfile("smith", [first, second]),
    );
  });

  it("deletes a judge's derived profile when no rounds remain", () => {
    saveJudgeProfile(buildJudgeProfile("smith", [entry()]));

    expect(rebuildJudgeProfileFromRecords("smith")).toBeNull();
    expect(getJudgeProfile("smith")).toBeUndefined();
  });
});

describe("updateJudgeRoundRecord", () => {
  it("replaces the round in place and re-aggregates the judge's profile", () => {
    recordJudgeRound(entry({ id: "r1", winningSide: "aff", affSpeakerPoints: 28 }));
    recordJudgeRound(entry({ id: "r2", winningSide: "aff", affSpeakerPoints: 28 }));

    const profile = updateJudgeRoundRecord(
      entry({ id: "r1", winningSide: "neg", affSpeakerPoints: 26 }),
    );

    expect(listJudgeRoundRecords().map((record) => record.id)).toEqual(["r1", "r2"]);
    expect(profile?.roundsJudged).toBe(2);
    expect(profile?.sideBias).toMatchObject({ affWins: 1, negWins: 1 });
    expect(getJudgeProfile("smith")?.avgSpeakerPoints.aff).toBe(27);
  });

  it("matches re-recording the corrected round from scratch", () => {
    const corrected = entry({ id: "r1", winningSide: "neg", paceWpm: 240 });
    recordJudgeRound(entry({ id: "r1", winningSide: "aff", paceWpm: 320 }));

    expect(updateJudgeRoundRecord(corrected)).toEqual(buildJudgeProfile("smith", [corrected]));
  });

  it("re-aggregates both judges when a round is reassigned", () => {
    recordJudgeRound(entry({ id: "r1", judgeId: "smith" }));
    recordJudgeRound(entry({ id: "r2", judgeId: "smith" }));

    const profile = updateJudgeRoundRecord(entry({ id: "r2", judgeId: "jones" }));

    expect(profile?.judgeId).toBe("jones");
    expect(getJudgeProfile("smith")?.roundsJudged).toBe(1);
    expect(getJudgeProfile("jones")?.roundsJudged).toBe(1);
  });

  it("deletes the previous judge's profile when the reassigned round was their last", () => {
    recordJudgeRound(entry({ id: "r1", judgeId: "smith" }));

    updateJudgeRoundRecord(entry({ id: "r1", judgeId: "jones" }));

    expect(getJudgeProfile("smith")).toBeUndefined();
    expect(getJudgeProfile("jones")?.roundsJudged).toBe(1);
  });

  it("is a no-op returning null for an unknown id", () => {
    const profile = recordJudgeRound(entry({ id: "r1" }));

    expect(updateJudgeRoundRecord(entry({ id: "does-not-exist", winningSide: "neg" }))).toBeNull();
    expect(listJudgeRoundRecords()).toHaveLength(1);
    expect(getJudgeProfile("smith")).toEqual(profile);
  });
});

describe("deleteJudgeRoundRecord", () => {
  it("removes the round and re-aggregates the judge's profile", () => {
    recordJudgeRound(entry({ id: "r1", winningSide: "aff" }));
    recordJudgeRound(entry({ id: "r2", winningSide: "neg" }));

    deleteJudgeRoundRecord("r2");

    expect(listJudgeRoundRecordsForJudge("smith")).toHaveLength(1);
    expect(getJudgeProfile("smith")?.roundsJudged).toBe(1);
    expect(getJudgeProfile("smith")?.sideBias.negWins).toBe(0);
  });

  it("deletes the derived profile once the judge's last round is removed", () => {
    recordJudgeRound(entry({ id: "r1" }));

    deleteJudgeRoundRecord("r1");

    expect(listJudgeRoundRecords()).toEqual([]);
    expect(getJudgeProfile("smith")).toBeUndefined();
  });

  it("is a no-op for an unknown id, leaving the profile untouched", () => {
    const profile = recordJudgeRound(entry({ id: "r1" }));

    deleteJudgeRoundRecord("does-not-exist");

    expect(listJudgeRoundRecords()).toHaveLength(1);
    expect(getJudgeProfile("smith")).toEqual(profile);
  });
});

describe("listJudgeIds", () => {
  it("returns every distinct logged judge id, sorted alphabetically", () => {
    recordJudgeRound(entry({ id: "r1", judgeId: "smith" }));
    recordJudgeRound(entry({ id: "r2", judgeId: "adams" }));
    recordJudgeRound(entry({ id: "r3", judgeId: "smith" }));

    expect(listJudgeIds()).toEqual(["adams", "smith"]);
  });

  it("returns an empty list when nothing is logged", () => {
    expect(listJudgeIds()).toEqual([]);
  });
});

describe("findNearestJudgeId", () => {
  it("suggests the closest known judge id to a typo", () => {
    recordJudgeRound(entry({ id: "r1", judgeId: "smith" }));
    recordJudgeRound(entry({ id: "r2", judgeId: "jones" }));

    expect(findNearestJudgeId("smth")).toBe("smith");
  });

  it("returns null for a blank query", () => {
    recordJudgeRound(entry({ id: "r1", judgeId: "smith" }));

    expect(findNearestJudgeId("   ")).toBeNull();
  });

  it("returns null when no judge is logged yet", () => {
    expect(findNearestJudgeId("smith")).toBeNull();
  });
});

describe("storage resilience", () => {
  it("degrades to an empty list when the stored JSON is corrupt", () => {
    localStorage.setItem("judgeRoundRecords", "{not json");

    expect(listJudgeRoundRecords()).toEqual([]);
  });

  it("degrades to an empty list when the stored value isn't an array", () => {
    localStorage.setItem("judgeRoundRecords", JSON.stringify({ smith: [] }));

    expect(listJudgeRoundRecords()).toEqual([]);
  });
});
