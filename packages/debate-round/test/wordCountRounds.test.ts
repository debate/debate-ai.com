import { beforeEach, describe, expect, it } from "vitest";
import {
  adoptWordCountRound,
  buildWordCountRoundsPanelView,
  buildWordCountTrendData,
  clearWordCountRounds,
  deleteWordCountRound,
  getWordCountRound,
  getWordCountRoundStatuses,
  listWordCountRounds,
  resolveWordCountRoundConflict,
  saveWordCountRound,
  type WordCountRoundRecord,
} from "../src/state/wordCountRounds";

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

const ROUND_A: WordCountRoundRecord = {
  roundId: "round-1",
  styleKey: "practicePublicForum",
  submittedSpeeches: [{ name: "AC", speaker: "A1", text: "Contention one is..." }],
};
const ROUND_B: WordCountRoundRecord = {
  roundId: "round-2",
  styleKey: "practicePublicForum",
  submittedSpeeches: [],
};

beforeEach(() => {
  (globalThis as unknown as { localStorage: MemoryStorage }).localStorage = new MemoryStorage();
});

describe("listWordCountRounds", () => {
  it("returns an empty list when nothing is stored", () => {
    expect(listWordCountRounds()).toEqual([]);
  });

  it("returns an empty list when the stored value is corrupt JSON", () => {
    localStorage.setItem("wordCountRounds", "{not json");
    expect(listWordCountRounds()).toEqual([]);
  });

  it("returns an empty list when the stored value isn't an array", () => {
    localStorage.setItem("wordCountRounds", JSON.stringify({ not: "an array" }));
    expect(listWordCountRounds()).toEqual([]);
  });

  it("lists every saved round", () => {
    saveWordCountRound(ROUND_A);
    saveWordCountRound(ROUND_B);
    const rounds = listWordCountRounds();
    expect(rounds).toHaveLength(2);
    expect(rounds[0]).toMatchObject(ROUND_A);
    expect(rounds[1]).toMatchObject(ROUND_B);
  });
});

describe("getWordCountRound", () => {
  it("finds a saved round by roundId", () => {
    saveWordCountRound(ROUND_A);
    expect(getWordCountRound("round-1")).toMatchObject(ROUND_A);
  });

  it("returns undefined for a roundId that isn't stored", () => {
    expect(getWordCountRound("missing")).toBeUndefined();
  });
});

describe("saveWordCountRound", () => {
  it("upserts — saving an existing roundId overwrites rather than duplicating it", () => {
    saveWordCountRound(ROUND_A);
    const updated: WordCountRoundRecord = {
      ...ROUND_A,
      submittedSpeeches: [
        ...ROUND_A.submittedSpeeches,
        { name: "NC", speaker: "N1", text: "The negative contends..." },
      ],
    };
    saveWordCountRound(updated);

    const stored = listWordCountRounds();
    expect(stored).toHaveLength(1);
    expect(stored[0]).toMatchObject(updated);
    expect(getWordCountRound("round-1")).toMatchObject(updated);
  });

  it("stamps createdAt with the current time on a round's first save", () => {
    const before = Date.now();
    saveWordCountRound(ROUND_A);
    const after = Date.now();

    const createdAt = getWordCountRound("round-1")?.createdAt;
    expect(createdAt).toEqual(expect.any(Number));
    expect(createdAt).toBeGreaterThanOrEqual(before);
    expect(createdAt).toBeLessThanOrEqual(after);
  });

  it("preserves the original createdAt across a later update to the same roundId", () => {
    saveWordCountRound(ROUND_A);
    const firstCreatedAt = getWordCountRound("round-1")?.createdAt;

    saveWordCountRound({
      ...ROUND_A,
      submittedSpeeches: [{ name: "AC", speaker: "A1", text: "A different draft" }],
    });

    expect(getWordCountRound("round-1")?.createdAt).toBe(firstCreatedAt);
  });

  it("stamps updatedAt with the current time on every save", () => {
    const before = Date.now();
    saveWordCountRound(ROUND_A);
    const after = Date.now();

    const updatedAt = getWordCountRound("round-1")?.updatedAt;
    expect(updatedAt).toEqual(expect.any(Number));
    expect(updatedAt).toBeGreaterThanOrEqual(before);
    expect(updatedAt).toBeLessThanOrEqual(after);
  });

  it("refreshes updatedAt on a later update to the same roundId, unlike createdAt", async () => {
    saveWordCountRound(ROUND_A);
    const firstUpdatedAt = getWordCountRound("round-1")?.updatedAt;

    await new Promise((resolve) => setTimeout(resolve, 2));
    saveWordCountRound({
      ...ROUND_A,
      submittedSpeeches: [{ name: "AC", speaker: "A1", text: "A different draft" }],
    });

    const secondUpdatedAt = getWordCountRound("round-1")?.updatedAt;
    expect(secondUpdatedAt).toEqual(expect.any(Number));
    expect(secondUpdatedAt).toBeGreaterThan(firstUpdatedAt!);
  });
});

describe("deleteWordCountRound", () => {
  it("removes a stored round by roundId", () => {
    saveWordCountRound(ROUND_A);
    saveWordCountRound(ROUND_B);
    deleteWordCountRound("round-1");

    const stored = listWordCountRounds();
    expect(stored).toHaveLength(1);
    expect(stored[0]).toMatchObject(ROUND_B);
    expect(getWordCountRound("round-1")).toBeUndefined();
  });

  it("is a no-op when the roundId isn't stored", () => {
    saveWordCountRound(ROUND_B);
    deleteWordCountRound("missing");
    const stored = listWordCountRounds();
    expect(stored).toHaveLength(1);
    expect(stored[0]).toMatchObject(ROUND_B);
  });
});

describe("clearWordCountRounds", () => {
  it("returns an empty array and is a no-op when nothing is stored", () => {
    expect(clearWordCountRounds()).toEqual([]);
    expect(listWordCountRounds()).toEqual([]);
  });

  it("removes every stored round and returns their roundIds", () => {
    saveWordCountRound(ROUND_A);
    saveWordCountRound(ROUND_B);

    const removedIds = clearWordCountRounds();

    expect(removedIds.sort()).toEqual(["round-1", "round-2"]);
    expect(listWordCountRounds()).toEqual([]);
  });
});

describe("adoptWordCountRound", () => {
  it("stores a record with its own createdAt preserved as-is, unlike saveWordCountRound", () => {
    const synced: WordCountRoundRecord = { ...ROUND_A, createdAt: 12345 };
    adoptWordCountRound(synced);

    expect(getWordCountRound("round-1")).toEqual(synced);
  });

  it("overwrites any existing local record for the same roundId", () => {
    saveWordCountRound(ROUND_A);
    const remote: WordCountRoundRecord = {
      ...ROUND_A,
      submittedSpeeches: [{ name: "AC", speaker: "A1", text: "A synced draft" }],
      createdAt: 999,
    };

    adoptWordCountRound(remote);

    const stored = listWordCountRounds();
    expect(stored).toHaveLength(1);
    expect(stored[0]).toEqual(remote);
  });
});

describe("resolveWordCountRoundConflict", () => {
  it("picks remote when remote's updatedAt is newer", () => {
    const local: WordCountRoundRecord = { ...ROUND_A, updatedAt: 100 };
    const remote: WordCountRoundRecord = { ...ROUND_A, updatedAt: 200 };
    expect(resolveWordCountRoundConflict(local, remote)).toBe("remote");
  });

  it("picks local when local's updatedAt is newer", () => {
    const local: WordCountRoundRecord = { ...ROUND_A, updatedAt: 200 };
    const remote: WordCountRoundRecord = { ...ROUND_A, updatedAt: 100 };
    expect(resolveWordCountRoundConflict(local, remote)).toBe("local");
  });

  it("returns none when both sides have the exact same updatedAt", () => {
    const local: WordCountRoundRecord = { ...ROUND_A, updatedAt: 150 };
    const remote: WordCountRoundRecord = { ...ROUND_A, updatedAt: 150 };
    expect(resolveWordCountRoundConflict(local, remote)).toBe("none");
  });

  it("returns none when neither side has an updatedAt", () => {
    const local: WordCountRoundRecord = { ...ROUND_A };
    const remote: WordCountRoundRecord = { ...ROUND_A };
    expect(resolveWordCountRoundConflict(local, remote)).toBe("none");
  });

  it("picks remote when only remote has an updatedAt", () => {
    const local: WordCountRoundRecord = { ...ROUND_A };
    const remote: WordCountRoundRecord = { ...ROUND_A, updatedAt: 100 };
    expect(resolveWordCountRoundConflict(local, remote)).toBe("remote");
  });

  it("picks local when only local has an updatedAt", () => {
    const local: WordCountRoundRecord = { ...ROUND_A, updatedAt: 100 };
    const remote: WordCountRoundRecord = { ...ROUND_A };
    expect(resolveWordCountRoundConflict(local, remote)).toBe("local");
  });
});

describe("getWordCountRoundStatuses", () => {
  it("returns an empty list when the round isn't persisted", () => {
    expect(getWordCountRoundStatuses("round-1")).toEqual([]);
  });

  it("computes each submitted speech's word-count status against its style's limit", () => {
    saveWordCountRound(ROUND_A);

    const statuses = getWordCountRoundStatuses("round-1");
    expect(statuses).toHaveLength(1);
    expect(statuses[0]).toMatchObject({ name: "AC", speaker: "A1" });
    expect(statuses[0].status.count).toBe(3);
    expect(statuses[0].status.overLimit).toBe(false);
  });

  it("skips a submission whose name no longer matches any speech in the style", () => {
    saveWordCountRound({
      roundId: "round-3",
      styleKey: "practicePublicForum",
      submittedSpeeches: [{ name: "not-a-real-speech", speaker: "A1", text: "hi" }],
    });

    expect(getWordCountRoundStatuses("round-3")).toEqual([]);
  });

  it("prefers a matching custom preset over the style's authored limit", () => {
    saveWordCountRound(ROUND_A);

    const statuses = getWordCountRoundStatuses("round-1", [{ name: "AC", wordLimit: 4 }]);
    expect(statuses[0].status.overLimit).toBe(false);
    expect(statuses[0].status.remaining).toBe(1);
  });
});

describe("buildWordCountRoundsPanelView", () => {
  it("returns an empty list when nothing is stored", () => {
    expect(buildWordCountRoundsPanelView()).toEqual([]);
  });

  it("sorts every persisted round by roundId", () => {
    saveWordCountRound(ROUND_B);
    saveWordCountRound(ROUND_A);

    expect(buildWordCountRoundsPanelView().map((round) => round.roundId)).toEqual(["round-1", "round-2"]);
  });

  it("leaves the underlying stored order untouched", () => {
    saveWordCountRound(ROUND_B);
    saveWordCountRound(ROUND_A);

    buildWordCountRoundsPanelView();

    expect(listWordCountRounds().map((round) => round.roundId)).toEqual(["round-2", "round-1"]);
  });
});

describe("buildWordCountTrendData", () => {
  it("returns an empty list when nothing is stored", () => {
    expect(buildWordCountTrendData()).toEqual([]);
  });

  it("excludes a record with no createdAt (persisted before the field existed)", () => {
    // ROUND_A is a raw literal with no createdAt — write it directly rather
    // than through saveWordCountRound, which would stamp one.
    localStorage.setItem("wordCountRounds", JSON.stringify([ROUND_A]));
    expect(buildWordCountTrendData()).toEqual([]);
  });

  it("flattens every round's submitted speeches into a single chronological list", () => {
    localStorage.setItem(
      "wordCountRounds",
      JSON.stringify([
        {
          roundId: "round-2",
          styleKey: "practicePublicForum",
          createdAt: 200,
          submittedSpeeches: [{ name: "AC", speaker: "A2", text: "one two three four five" }],
        },
        {
          roundId: "round-1",
          styleKey: "practicePublicForum",
          createdAt: 100,
          submittedSpeeches: [{ name: "AC", speaker: "A1", text: "one two three" }],
        },
      ]),
    );

    const trend = buildWordCountTrendData();
    expect(trend.map((point) => point.roundId)).toEqual(["round-1", "round-2"]);
    expect(trend[0]).toMatchObject({ name: "AC", speaker: "A1", createdAt: 100, count: 3, overLimit: false });
    expect(trend[1]).toMatchObject({ name: "AC", speaker: "A2", createdAt: 200, count: 5, overLimit: false });
  });

  it("skips a submission whose name no longer matches any speech in its round's style", () => {
    localStorage.setItem(
      "wordCountRounds",
      JSON.stringify([
        {
          roundId: "round-3",
          styleKey: "practicePublicForum",
          createdAt: 100,
          submittedSpeeches: [{ name: "not-a-real-speech", speaker: "A1", text: "hi" }],
        },
      ]),
    );

    expect(buildWordCountTrendData()).toEqual([]);
  });

  it("prefers a matching custom preset over the style's authored limit", () => {
    localStorage.setItem(
      "wordCountRounds",
      JSON.stringify([
        {
          roundId: "round-1",
          styleKey: "practicePublicForum",
          createdAt: 100,
          submittedSpeeches: [{ name: "AC", speaker: "A1", text: "one two three four five" }],
        },
      ]),
    );

    const trend = buildWordCountTrendData([{ name: "AC", wordLimit: 4 }]);
    expect(trend[0]).toMatchObject({ wordLimit: 4, count: 5, overLimit: true });
  });
});
