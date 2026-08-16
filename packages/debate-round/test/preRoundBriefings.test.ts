import { beforeEach, describe, expect, it } from "vitest";
import {
  deletePreRoundBriefing,
  getPreRoundBriefing,
  listPreRoundBriefings,
  savePreRoundBriefing,
  type PreRoundBriefingRecord,
} from "../src/state/preRoundBriefings";

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

const BRIEFING_A: PreRoundBriefingRecord = {
  roundId: "round-1",
  briefing: {
    event: {
      tournamentName: "Blake",
      division: "LD",
      roundLabel: "Round 4",
      side: "aff",
    },
    priorMeetings: { meetings: 1, wins: 1, losses: 0 },
    sections: [{ title: "Event", body: "Blake — LD, Round 4\nSide: aff" }],
  },
};
const BRIEFING_B: PreRoundBriefingRecord = {
  roundId: "round-2",
  briefing: {
    event: {
      tournamentName: "Greenhill",
      division: "PF",
      roundLabel: "Round 1",
      side: "neg",
    },
    priorMeetings: { meetings: 0, wins: 0, losses: 0 },
    sections: [{ title: "Event", body: "Greenhill — PF, Round 1\nSide: neg" }],
  },
};

beforeEach(() => {
  (globalThis as unknown as { localStorage: MemoryStorage }).localStorage = new MemoryStorage();
});

describe("listPreRoundBriefings", () => {
  it("returns an empty list when nothing is stored", () => {
    expect(listPreRoundBriefings()).toEqual([]);
  });

  it("returns an empty list when the stored value is corrupt JSON", () => {
    localStorage.setItem("preRoundBriefings", "{not json");
    expect(listPreRoundBriefings()).toEqual([]);
  });

  it("returns an empty list when the stored value isn't an array", () => {
    localStorage.setItem("preRoundBriefings", JSON.stringify({ not: "an array" }));
    expect(listPreRoundBriefings()).toEqual([]);
  });

  it("lists every saved briefing", () => {
    savePreRoundBriefing(BRIEFING_A);
    savePreRoundBriefing(BRIEFING_B);
    expect(listPreRoundBriefings()).toEqual([BRIEFING_A, BRIEFING_B]);
  });
});

describe("getPreRoundBriefing", () => {
  it("finds a saved briefing by roundId", () => {
    savePreRoundBriefing(BRIEFING_A);
    expect(getPreRoundBriefing("round-1")).toEqual(BRIEFING_A);
  });

  it("returns undefined for a roundId that isn't stored", () => {
    expect(getPreRoundBriefing("missing")).toBeUndefined();
  });
});

describe("savePreRoundBriefing", () => {
  it("upserts — saving an existing roundId overwrites rather than duplicating it", () => {
    savePreRoundBriefing(BRIEFING_A);
    const updated: PreRoundBriefingRecord = {
      ...BRIEFING_A,
      briefing: { ...BRIEFING_A.briefing, priorMeetings: { meetings: 2, wins: 1, losses: 1 } },
    };
    savePreRoundBriefing(updated);

    expect(listPreRoundBriefings()).toEqual([updated]);
    expect(getPreRoundBriefing("round-1")).toEqual(updated);
  });
});

describe("deletePreRoundBriefing", () => {
  it("removes a stored briefing by roundId", () => {
    savePreRoundBriefing(BRIEFING_A);
    savePreRoundBriefing(BRIEFING_B);
    deletePreRoundBriefing("round-1");

    expect(listPreRoundBriefings()).toEqual([BRIEFING_B]);
    expect(getPreRoundBriefing("round-1")).toBeUndefined();
  });

  it("is a no-op when the roundId isn't stored", () => {
    savePreRoundBriefing(BRIEFING_B);
    deletePreRoundBriefing("missing");
    expect(listPreRoundBriefings()).toEqual([BRIEFING_B]);
  });
});
