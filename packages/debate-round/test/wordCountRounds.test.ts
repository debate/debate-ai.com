import { beforeEach, describe, expect, it } from "vitest";
import {
  buildWordCountRoundsPanelView,
  deleteWordCountRound,
  getWordCountRound,
  getWordCountRoundStatuses,
  listWordCountRounds,
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
    expect(listWordCountRounds()).toEqual([ROUND_A, ROUND_B]);
  });
});

describe("getWordCountRound", () => {
  it("finds a saved round by roundId", () => {
    saveWordCountRound(ROUND_A);
    expect(getWordCountRound("round-1")).toEqual(ROUND_A);
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

    expect(listWordCountRounds()).toEqual([updated]);
    expect(getWordCountRound("round-1")).toEqual(updated);
  });
});

describe("deleteWordCountRound", () => {
  it("removes a stored round by roundId", () => {
    saveWordCountRound(ROUND_A);
    saveWordCountRound(ROUND_B);
    deleteWordCountRound("round-1");

    expect(listWordCountRounds()).toEqual([ROUND_B]);
    expect(getWordCountRound("round-1")).toBeUndefined();
  });

  it("is a no-op when the roundId isn't stored", () => {
    saveWordCountRound(ROUND_B);
    deleteWordCountRound("missing");
    expect(listWordCountRounds()).toEqual([ROUND_B]);
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

    expect(buildWordCountRoundsPanelView()).toEqual([ROUND_A, ROUND_B]);
  });

  it("leaves the underlying stored order untouched", () => {
    saveWordCountRound(ROUND_B);
    saveWordCountRound(ROUND_A);

    buildWordCountRoundsPanelView();

    expect(listWordCountRounds()).toEqual([ROUND_B, ROUND_A]);
  });
});
