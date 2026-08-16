import { beforeEach, describe, expect, it } from "vitest";
import {
  deleteAiVersusRound,
  getAiVersusRound,
  listAiVersusRounds,
  saveAiVersusRound,
  type AiVersusRoundRecord,
} from "../src/state/aiVersusRounds";

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

const ROUND_A: AiVersusRoundRecord = {
  roundId: "round-1",
  styleKey: "policy",
  userSide: "primary",
  submittedSpeeches: [{ name: "1AC", speaker: "user", text: "Contention one is..." }],
};
const ROUND_B: AiVersusRoundRecord = {
  roundId: "round-2",
  styleKey: "lincolnDouglas",
  userSide: "secondary",
  submittedSpeeches: [],
};

beforeEach(() => {
  (globalThis as unknown as { localStorage: MemoryStorage }).localStorage = new MemoryStorage();
});

describe("listAiVersusRounds", () => {
  it("returns an empty list when nothing is stored", () => {
    expect(listAiVersusRounds()).toEqual([]);
  });

  it("returns an empty list when the stored value is corrupt JSON", () => {
    localStorage.setItem("aiVersusRounds", "{not json");
    expect(listAiVersusRounds()).toEqual([]);
  });

  it("returns an empty list when the stored value isn't an array", () => {
    localStorage.setItem("aiVersusRounds", JSON.stringify({ not: "an array" }));
    expect(listAiVersusRounds()).toEqual([]);
  });

  it("lists every saved round", () => {
    saveAiVersusRound(ROUND_A);
    saveAiVersusRound(ROUND_B);
    expect(listAiVersusRounds()).toEqual([ROUND_A, ROUND_B]);
  });
});

describe("getAiVersusRound", () => {
  it("finds a saved round by roundId", () => {
    saveAiVersusRound(ROUND_A);
    expect(getAiVersusRound("round-1")).toEqual(ROUND_A);
  });

  it("returns undefined for a roundId that isn't stored", () => {
    expect(getAiVersusRound("missing")).toBeUndefined();
  });
});

describe("saveAiVersusRound", () => {
  it("upserts — saving an existing roundId overwrites rather than duplicating it", () => {
    saveAiVersusRound(ROUND_A);
    const updated: AiVersusRoundRecord = {
      ...ROUND_A,
      submittedSpeeches: [
        ...ROUND_A.submittedSpeeches,
        { name: "1NC", speaker: "ai", text: "The negative contends..." },
      ],
    };
    saveAiVersusRound(updated);

    expect(listAiVersusRounds()).toEqual([updated]);
    expect(getAiVersusRound("round-1")).toEqual(updated);
  });
});

describe("deleteAiVersusRound", () => {
  it("removes a stored round by roundId", () => {
    saveAiVersusRound(ROUND_A);
    saveAiVersusRound(ROUND_B);
    deleteAiVersusRound("round-1");

    expect(listAiVersusRounds()).toEqual([ROUND_B]);
    expect(getAiVersusRound("round-1")).toBeUndefined();
  });

  it("is a no-op when the roundId isn't stored", () => {
    saveAiVersusRound(ROUND_B);
    deleteAiVersusRound("missing");
    expect(listAiVersusRounds()).toEqual([ROUND_B]);
  });
});
