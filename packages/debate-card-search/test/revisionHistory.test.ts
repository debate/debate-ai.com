import { beforeEach, describe, expect, it } from "vitest";
import {
  buildDailyTopReviserAnnouncements,
  buildPersistedRevisionIncentiveLeaderboard,
  deleteRevisionRecord,
  getRevisionRecord,
  listRevisionHistory,
  listRevisionHistoryForCard,
  listRevisionHistoryForContributor,
  saveRevisionRecord,
  type CardRevisionRecord,
} from "../src/state/revisionHistory";
import { buildRevisionIncentiveLeaderboard } from "../src/lib/revision-incentives";

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

function snapshot(overrides: Partial<CardRevisionRecord["before"]> = {}) {
  return {
    qualitySignals: [0.3, 0.3],
    citationCompleteness: 0.4,
    evidenceYear: 2018,
    wordCount: 200,
    ...overrides,
  };
}

const ALICE_FIRST_EDIT: CardRevisionRecord = {
  id: "rev-1",
  cardId: "card-1",
  contributorId: "alice",
  revisedAt: "2026-01-01T00:00:00.000Z",
  before: snapshot({ qualitySignals: [0.2, 0.2] }),
  after: snapshot({ qualitySignals: [0.9, 0.9] }),
};
const ALICE_SECOND_EDIT: CardRevisionRecord = {
  id: "rev-2",
  cardId: "card-1",
  contributorId: "alice",
  revisedAt: "2026-01-02T00:00:00.000Z",
  before: snapshot({ qualitySignals: [0.9, 0.9], citationCompleteness: 0.4 }),
  after: snapshot({ qualitySignals: [0.9, 0.9], citationCompleteness: 0.7 }),
};
const BOB_EDIT: CardRevisionRecord = {
  id: "rev-3",
  cardId: "card-2",
  contributorId: "bob",
  revisedAt: "2026-01-01T12:00:00.000Z",
  before: snapshot({ evidenceYear: 2015 }),
  after: snapshot({ evidenceYear: 2024 }),
};

beforeEach(() => {
  (globalThis as unknown as { localStorage: MemoryStorage }).localStorage = new MemoryStorage();
});

describe("listRevisionHistory", () => {
  it("returns an empty list when nothing is stored", () => {
    expect(listRevisionHistory()).toEqual([]);
  });

  it("returns an empty list when the stored value is corrupt JSON", () => {
    localStorage.setItem("revisionHistory", "{not json");
    expect(listRevisionHistory()).toEqual([]);
  });

  it("returns an empty list when the stored value isn't an array", () => {
    localStorage.setItem("revisionHistory", JSON.stringify({ not: "an array" }));
    expect(listRevisionHistory()).toEqual([]);
  });

  it("lists every saved record ordered oldest to newest, regardless of save order", () => {
    saveRevisionRecord(ALICE_SECOND_EDIT);
    saveRevisionRecord(ALICE_FIRST_EDIT);
    saveRevisionRecord(BOB_EDIT);
    expect(listRevisionHistory().map((r) => r.id)).toEqual(["rev-1", "rev-3", "rev-2"]);
  });
});

describe("listRevisionHistoryForCard", () => {
  it("lists only revisions for the given card, oldest first", () => {
    saveRevisionRecord(ALICE_SECOND_EDIT);
    saveRevisionRecord(ALICE_FIRST_EDIT);
    saveRevisionRecord(BOB_EDIT);
    expect(listRevisionHistoryForCard("card-1").map((r) => r.id)).toEqual(["rev-1", "rev-2"]);
  });

  it("returns an empty list for a card with no recorded revisions", () => {
    expect(listRevisionHistoryForCard("missing")).toEqual([]);
  });
});

describe("listRevisionHistoryForContributor", () => {
  it("lists only revisions attributed to the given contributor, oldest first", () => {
    saveRevisionRecord(ALICE_SECOND_EDIT);
    saveRevisionRecord(ALICE_FIRST_EDIT);
    saveRevisionRecord(BOB_EDIT);
    expect(listRevisionHistoryForContributor("alice").map((r) => r.id)).toEqual(["rev-1", "rev-2"]);
    expect(listRevisionHistoryForContributor("bob").map((r) => r.id)).toEqual(["rev-3"]);
  });

  it("returns an empty list for a contributor with no recorded revisions", () => {
    expect(listRevisionHistoryForContributor("missing")).toEqual([]);
  });
});

describe("getRevisionRecord", () => {
  it("finds a saved record by id", () => {
    saveRevisionRecord(ALICE_FIRST_EDIT);
    expect(getRevisionRecord("rev-1")).toEqual(ALICE_FIRST_EDIT);
  });

  it("returns undefined for an id that isn't stored", () => {
    expect(getRevisionRecord("missing")).toBeUndefined();
  });
});

describe("saveRevisionRecord", () => {
  it("appends a new revision rather than overwriting a prior one for the same card", () => {
    saveRevisionRecord(ALICE_FIRST_EDIT);
    saveRevisionRecord(ALICE_SECOND_EDIT);
    expect(listRevisionHistoryForCard("card-1")).toHaveLength(2);
  });

  it("upserts — saving an existing id overwrites rather than duplicating it", () => {
    saveRevisionRecord(ALICE_FIRST_EDIT);
    const corrected: CardRevisionRecord = { ...ALICE_FIRST_EDIT, after: snapshot({ qualitySignals: [1, 1] }) };
    saveRevisionRecord(corrected);

    expect(listRevisionHistory()).toEqual([corrected]);
    expect(getRevisionRecord("rev-1")).toEqual(corrected);
  });
});

describe("deleteRevisionRecord", () => {
  it("removes a stored record by id", () => {
    saveRevisionRecord(ALICE_FIRST_EDIT);
    saveRevisionRecord(BOB_EDIT);
    deleteRevisionRecord("rev-1");

    expect(listRevisionHistory()).toEqual([BOB_EDIT]);
    expect(getRevisionRecord("rev-1")).toBeUndefined();
  });

  it("is a no-op when the id isn't stored", () => {
    saveRevisionRecord(BOB_EDIT);
    deleteRevisionRecord("missing");
    expect(listRevisionHistory()).toEqual([BOB_EDIT]);
  });
});

describe("interop with revision-incentives.ts scoring", () => {
  it("feeds a card's persisted history directly into buildRevisionIncentiveLeaderboard", () => {
    saveRevisionRecord(ALICE_FIRST_EDIT);
    saveRevisionRecord(ALICE_SECOND_EDIT);
    saveRevisionRecord(BOB_EDIT);

    const leaderboard = buildRevisionIncentiveLeaderboard(listRevisionHistory());
    expect(leaderboard.map((s) => s.contributorId).sort()).toEqual(["alice", "bob"]);
    expect(leaderboard.find((s) => s.contributorId === "alice")?.revisionCount).toBe(2);
  });
});

describe("buildPersistedRevisionIncentiveLeaderboard", () => {
  it("returns an empty leaderboard when nothing is stored", () => {
    expect(buildPersistedRevisionIncentiveLeaderboard()).toEqual([]);
  });

  it("builds a ranked leaderboard directly from every persisted revision record", () => {
    saveRevisionRecord(ALICE_FIRST_EDIT);
    saveRevisionRecord(ALICE_SECOND_EDIT);
    saveRevisionRecord(BOB_EDIT);

    const leaderboard = buildPersistedRevisionIncentiveLeaderboard();
    expect(leaderboard).toEqual(buildRevisionIncentiveLeaderboard(listRevisionHistory()));
    expect(leaderboard.map((s) => s.contributorId).sort()).toEqual(["alice", "bob"]);
  });

  it("reflects a newly saved revision without requiring the caller to re-fetch the full list", () => {
    saveRevisionRecord(BOB_EDIT);
    expect(buildPersistedRevisionIncentiveLeaderboard().map((s) => s.contributorId)).toEqual(["bob"]);

    saveRevisionRecord(ALICE_FIRST_EDIT);
    expect(buildPersistedRevisionIncentiveLeaderboard().map((s) => s.contributorId).sort()).toEqual([
      "alice",
      "bob",
    ]);
  });
});

describe("buildDailyTopReviserAnnouncements", () => {
  it("returns an empty list when nothing is stored", () => {
    expect(buildDailyTopReviserAnnouncements()).toEqual([]);
  });

  it("groups revisions by UTC day and reports the top-scoring contributor per day", () => {
    saveRevisionRecord(ALICE_FIRST_EDIT); // 2026-01-01, earns 70 points
    saveRevisionRecord(BOB_EDIT); // 2026-01-01, earns 5 points
    saveRevisionRecord(ALICE_SECOND_EDIT); // 2026-01-02, earns 8 points

    const announcements = buildDailyTopReviserAnnouncements();
    expect(announcements.map((a) => a.dayKey)).toEqual(["2026-01-02", "2026-01-01"]);

    const day1 = announcements.find((a) => a.dayKey === "2026-01-01");
    expect(day1?.topContributor.contributorId).toBe("alice");
    expect(day1?.topContributor.totalRewardPoints).toBe(70);

    const day2 = announcements.find((a) => a.dayKey === "2026-01-02");
    expect(day2?.topContributor.contributorId).toBe("alice");
    expect(day2?.topContributor.totalRewardPoints).toBe(8);
  });

  it("excludes a day whose only revisions earned no reward", () => {
    const noRewardEdit: CardRevisionRecord = {
      id: "rev-no-reward",
      cardId: "card-3",
      contributorId: "carol",
      revisedAt: "2026-02-01T00:00:00.000Z",
      before: snapshot(),
      after: snapshot(),
    };
    saveRevisionRecord(noRewardEdit);
    expect(buildDailyTopReviserAnnouncements()).toEqual([]);
  });

  it("sorts newest day first", () => {
    saveRevisionRecord(ALICE_FIRST_EDIT); // 2026-01-01
    saveRevisionRecord(ALICE_SECOND_EDIT); // 2026-01-02
    expect(buildDailyTopReviserAnnouncements().map((a) => a.dayKey)).toEqual(["2026-01-02", "2026-01-01"]);
  });
});
