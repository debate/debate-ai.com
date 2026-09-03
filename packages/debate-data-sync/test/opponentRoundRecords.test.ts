import { beforeEach, describe, expect, it } from "vitest";
import {
  bulkImportOpponentRoundRecords,
  deleteOpponentRoundRecord,
  findNearestOpponentTeamId,
  hasOpponentRoundRecordEditHistory,
  hasOpponentRoundRecordRedoHistory,
  listOpponentRoundRecordEditHistory,
  listOpponentRoundRecordRedoHistory,
  listOpponentRoundRecords,
  listOpponentRoundRecordsForTeam,
  listOpponentTeamIds,
  rebuildOpponentTeamProfileFromRecords,
  recordOpponentRound,
  redoLastOpponentRoundRecordEdit,
  undoLastOpponentRoundRecordEdit,
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

describe("hasOpponentRoundRecordEditHistory / listOpponentRoundRecordEditHistory", () => {
  it("reports no history for a round that has never been edited", () => {
    recordOpponentRound(entry({ id: "r1" }));

    expect(hasOpponentRoundRecordEditHistory("r1")).toBe(false);
    expect(listOpponentRoundRecordEditHistory("r1")).toEqual([]);
  });

  it("reports no history for an unknown id", () => {
    expect(hasOpponentRoundRecordEditHistory("does-not-exist")).toBe(false);
  });

  it("records the pre-edit version, most-recent-edit-first", () => {
    const original = entry({ id: "r1", side: "aff", won: true });
    recordOpponentRound(original);
    updateOpponentRoundRecord(entry({ id: "r1", side: "neg", won: false }));
    const afterFirstEdit = entry({ id: "r1", side: "neg", won: false });
    updateOpponentRoundRecord(entry({ id: "r1", side: "aff", won: true, caseName: "Warming" }));

    expect(hasOpponentRoundRecordEditHistory("r1")).toBe(true);
    expect(listOpponentRoundRecordEditHistory("r1")).toEqual([afterFirstEdit, original]);
  });

  it("caps history at the 10 most recent prior versions", () => {
    recordOpponentRound(entry({ id: "r1", caseName: "v0" }));
    for (let i = 1; i <= 12; i++) {
      updateOpponentRoundRecord(entry({ id: "r1", caseName: `v${i}` }));
    }

    const history = listOpponentRoundRecordEditHistory("r1");
    expect(history).toHaveLength(10);
    expect(history[0]?.caseName).toBe("v11");
    expect(history[9]?.caseName).toBe("v2");
  });
});

describe("undoLastOpponentRoundRecordEdit", () => {
  it("restores the round to its version before the most recent edit", () => {
    recordOpponentRound(entry({ id: "r1", side: "aff", won: true }));
    updateOpponentRoundRecord(entry({ id: "r1", side: "neg", won: false }));

    const profile = undoLastOpponentRoundRecordEdit("r1");

    expect(listOpponentRoundRecords()).toEqual([
      entry({ id: "r1", side: "aff", won: true }),
    ]);
    expect(profile?.sideRecord.aff).toMatchObject({ rounds: 1, wins: 1 });
    expect(getOpponentTeamProfile("wxyz")?.record.wins).toBe(1);
  });

  it("steps back one edit at a time across multiple corrections", () => {
    recordOpponentRound(entry({ id: "r1", caseName: "v0" }));
    updateOpponentRoundRecord(entry({ id: "r1", caseName: "v1" }));
    updateOpponentRoundRecord(entry({ id: "r1", caseName: "v2" }));

    undoLastOpponentRoundRecordEdit("r1");
    expect(listOpponentRoundRecords()[0]?.caseName).toBe("v1");

    undoLastOpponentRoundRecordEdit("r1");
    expect(listOpponentRoundRecords()[0]?.caseName).toBe("v0");

    expect(hasOpponentRoundRecordEditHistory("r1")).toBe(false);
  });

  it("re-aggregates both teams when undoing a reassignment", () => {
    recordOpponentRound(entry({ id: "r1", teamId: "wxyz" }));
    updateOpponentRoundRecord(entry({ id: "r1", teamId: "abcd" }));

    const profile = undoLastOpponentRoundRecordEdit("r1");

    expect(profile?.teamId).toBe("wxyz");
    expect(getOpponentTeamProfile("wxyz")?.roundsRecorded).toBe(1);
    expect(getOpponentTeamProfile("abcd")).toBeUndefined();
  });

  it("is a no-op returning null for a round that was never edited", () => {
    const profile = recordOpponentRound(entry({ id: "r1" }));

    expect(undoLastOpponentRoundRecordEdit("r1")).toBeNull();
    expect(getOpponentTeamProfile("wxyz")).toEqual(profile);
  });

  it("is a no-op returning null for an unknown id", () => {
    recordOpponentRound(entry({ id: "r1" }));

    expect(undoLastOpponentRoundRecordEdit("does-not-exist")).toBeNull();
  });

  it("clears the round's edit history when it is deleted", () => {
    recordOpponentRound(entry({ id: "r1" }));
    updateOpponentRoundRecord(entry({ id: "r1", caseName: "v1" }));

    deleteOpponentRoundRecord("r1");

    expect(hasOpponentRoundRecordEditHistory("r1")).toBe(false);
  });
});

describe("hasOpponentRoundRecordRedoHistory / listOpponentRoundRecordRedoHistory", () => {
  it("reports no redo history for a round that has never been undone", () => {
    recordOpponentRound(entry({ id: "r1" }));
    updateOpponentRoundRecord(entry({ id: "r1", caseName: "v1" }));

    expect(hasOpponentRoundRecordRedoHistory("r1")).toBe(false);
    expect(listOpponentRoundRecordRedoHistory("r1")).toEqual([]);
  });

  it("reports no redo history for an unknown id", () => {
    expect(hasOpponentRoundRecordRedoHistory("does-not-exist")).toBe(false);
  });

  it("records the replaced version once undone, most-recently-undone-first", () => {
    recordOpponentRound(entry({ id: "r1", caseName: "v0" }));
    updateOpponentRoundRecord(entry({ id: "r1", caseName: "v1" }));
    updateOpponentRoundRecord(entry({ id: "r1", caseName: "v2" }));

    undoLastOpponentRoundRecordEdit("r1");
    undoLastOpponentRoundRecordEdit("r1");

    expect(hasOpponentRoundRecordRedoHistory("r1")).toBe(true);
    const redoHistory = listOpponentRoundRecordRedoHistory("r1");
    expect(redoHistory.map((r) => r.caseName)).toEqual(["v1", "v2"]);
  });
});

describe("redoLastOpponentRoundRecordEdit", () => {
  it("re-applies the version replaced by the most recent undo", () => {
    recordOpponentRound(entry({ id: "r1", side: "aff", won: true }));
    updateOpponentRoundRecord(entry({ id: "r1", side: "neg", won: false }));
    undoLastOpponentRoundRecordEdit("r1");

    const profile = redoLastOpponentRoundRecordEdit("r1");

    expect(listOpponentRoundRecords()).toEqual([
      entry({ id: "r1", side: "neg", won: false }),
    ]);
    expect(profile?.sideRecord.neg).toMatchObject({ rounds: 1, wins: 0 });
    expect(hasOpponentRoundRecordRedoHistory("r1")).toBe(false);
  });

  it("steps forward one undo at a time across multiple undos", () => {
    recordOpponentRound(entry({ id: "r1", caseName: "v0" }));
    updateOpponentRoundRecord(entry({ id: "r1", caseName: "v1" }));
    updateOpponentRoundRecord(entry({ id: "r1", caseName: "v2" }));
    undoLastOpponentRoundRecordEdit("r1");
    undoLastOpponentRoundRecordEdit("r1");

    redoLastOpponentRoundRecordEdit("r1");
    expect(listOpponentRoundRecords()[0]?.caseName).toBe("v1");

    redoLastOpponentRoundRecordEdit("r1");
    expect(listOpponentRoundRecords()[0]?.caseName).toBe("v2");

    expect(hasOpponentRoundRecordRedoHistory("r1")).toBe(false);
  });

  it("lets a redone version be undone again", () => {
    recordOpponentRound(entry({ id: "r1", caseName: "v0" }));
    updateOpponentRoundRecord(entry({ id: "r1", caseName: "v1" }));
    undoLastOpponentRoundRecordEdit("r1");
    redoLastOpponentRoundRecordEdit("r1");

    undoLastOpponentRoundRecordEdit("r1");

    expect(listOpponentRoundRecords()[0]?.caseName).toBe("v0");
  });

  it("re-aggregates both teams when redoing a reassignment", () => {
    recordOpponentRound(entry({ id: "r1", teamId: "wxyz" }));
    updateOpponentRoundRecord(entry({ id: "r1", teamId: "abcd" }));
    undoLastOpponentRoundRecordEdit("r1");

    const profile = redoLastOpponentRoundRecordEdit("r1");

    expect(profile?.teamId).toBe("abcd");
    expect(getOpponentTeamProfile("abcd")?.roundsRecorded).toBe(1);
    expect(getOpponentTeamProfile("wxyz")).toBeUndefined();
  });

  it("is a no-op returning null for a round with nothing to redo", () => {
    const profile = recordOpponentRound(entry({ id: "r1" }));

    expect(redoLastOpponentRoundRecordEdit("r1")).toBeNull();
    expect(getOpponentTeamProfile("wxyz")).toEqual(profile);
  });

  it("is a no-op returning null for an unknown id", () => {
    recordOpponentRound(entry({ id: "r1" }));

    expect(redoLastOpponentRoundRecordEdit("does-not-exist")).toBeNull();
  });

  it("is cleared by a fresh edit made after an undo", () => {
    recordOpponentRound(entry({ id: "r1", caseName: "v0" }));
    updateOpponentRoundRecord(entry({ id: "r1", caseName: "v1" }));
    undoLastOpponentRoundRecordEdit("r1");
    expect(hasOpponentRoundRecordRedoHistory("r1")).toBe(true);

    updateOpponentRoundRecord(entry({ id: "r1", caseName: "v2" }));

    expect(hasOpponentRoundRecordRedoHistory("r1")).toBe(false);
    expect(redoLastOpponentRoundRecordEdit("r1")).toBeNull();
  });

  it("is cleared when the round is deleted", () => {
    recordOpponentRound(entry({ id: "r1" }));
    updateOpponentRoundRecord(entry({ id: "r1", caseName: "v1" }));
    undoLastOpponentRoundRecordEdit("r1");

    deleteOpponentRoundRecord("r1");

    expect(hasOpponentRoundRecordRedoHistory("r1")).toBe(false);
  });
});

describe("listOpponentTeamIds", () => {
  it("returns every distinct logged team id, sorted alphabetically", () => {
    recordOpponentRound(entry({ id: "r1", teamId: "wxyz" }));
    recordOpponentRound(entry({ id: "r2", teamId: "abcd" }));
    recordOpponentRound(entry({ id: "r3", teamId: "wxyz" }));

    expect(listOpponentTeamIds()).toEqual(["abcd", "wxyz"]);
  });

  it("returns an empty list when nothing is logged", () => {
    expect(listOpponentTeamIds()).toEqual([]);
  });
});

describe("findNearestOpponentTeamId", () => {
  it("suggests the closest known team id to a typo", () => {
    recordOpponentRound(entry({ id: "r1", teamId: "wxyz" }));
    recordOpponentRound(entry({ id: "r2", teamId: "abcd" }));

    expect(findNearestOpponentTeamId("wxyd")).toBe("wxyz");
  });

  it("returns null for a blank query", () => {
    recordOpponentRound(entry({ id: "r1", teamId: "wxyz" }));

    expect(findNearestOpponentTeamId("   ")).toBeNull();
  });

  it("returns null when no team is logged yet", () => {
    expect(findNearestOpponentTeamId("wxyz")).toBeNull();
  });
});

describe("bulkImportOpponentRoundRecords", () => {
  it("persists every well-formed CSV row and aggregates each affected team once", () => {
    const csv = [
      "teamId,tournamentName,date,division,side,won,argumentTags,caseName,opponentTeamId",
      "wxyz,Berkeley,2026-01-10,PF,aff,true,kritik,Housing Case,",
      "wxyz,Glenbrooks,2026-02-01,PF,neg,false,,,",
      "abcd,Berkeley,2026-01-10,PF,aff,true,,,",
    ].join("\n");

    const result = bulkImportOpponentRoundRecords(csv);

    expect(result).toMatchObject({ importedCount: 3, skippedCount: 0, errors: [] });
    expect(result.affectedTeamIds.sort()).toEqual(["abcd", "wxyz"]);
    expect(listOpponentRoundRecords()).toHaveLength(3);

    const wxyzProfile = getOpponentTeamProfile("wxyz");
    expect(wxyzProfile?.roundsRecorded).toBe(2);
    expect(wxyzProfile?.record).toMatchObject({ wins: 1, losses: 1 });
    expect(getOpponentTeamProfile("abcd")?.roundsRecorded).toBe(1);
  });

  it("assigns every imported row its own id even when team/tournament/date match", () => {
    const csv = [
      "teamId,tournamentName,date,division,side,won",
      "wxyz,Berkeley,2026-01-10,PF,aff,true",
      "wxyz,Berkeley,2026-01-10,PF,neg,false",
    ].join("\n");

    bulkImportOpponentRoundRecords(csv);

    const ids = listOpponentRoundRecords().map((record) => record.id);
    expect(new Set(ids).size).toBe(2);
  });

  it("imports the well-formed rows and reports the skipped ones", () => {
    const csv = [
      "teamId,tournamentName,date,division,side,won",
      "wxyz,Berkeley,2026-01-10,PF,aff,true",
      ",Glenbrooks,2026-02-01,PF,neg,false",
    ].join("\n");

    const result = bulkImportOpponentRoundRecords(csv);

    expect(result.importedCount).toBe(1);
    expect(result.skippedCount).toBe(1);
    expect(result.errors).toHaveLength(1);
    expect(listOpponentRoundRecords()).toHaveLength(1);
  });

  it("does not touch storage or any profile when every row is invalid", () => {
    const result = bulkImportOpponentRoundRecords("teamId,tournamentName,date,division,side,won");

    expect(result).toMatchObject({ importedCount: 0, skippedCount: 0, affectedTeamIds: [] });
    expect(listOpponentRoundRecords()).toEqual([]);
  });

  it("merges into a team's existing rounds rather than replacing them", () => {
    recordOpponentRound(entry({ id: "r1", teamId: "wxyz", tournamentName: "Berkeley" }));

    const result = bulkImportOpponentRoundRecords(
      ["teamId,tournamentName,date,division,side,won", "wxyz,Glenbrooks,2026-02-01,PF,neg,false"].join("\n"),
    );

    expect(result.importedCount).toBe(1);
    expect(getOpponentTeamProfile("wxyz")?.roundsRecorded).toBe(2);
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
