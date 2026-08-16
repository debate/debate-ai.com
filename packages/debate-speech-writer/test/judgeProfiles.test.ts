import { beforeEach, describe, expect, it } from "vitest";
import {
  deleteJudgeProfile,
  getJudgeProfile,
  listJudgeProfiles,
  saveJudgeProfile,
} from "../src/state/judgeProfiles";
import { buildJudgeProfile, type JudgeProfile } from "../src/judge/judge-profile";

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

const SMITH: JudgeProfile = buildJudgeProfile("smith", [
  {
    judgeId: "smith",
    tournamentName: "Berkeley",
    date: "2026-01-01",
    division: "PF",
    winningSide: "aff",
    affSpeakerPoints: 28,
    negSpeakerPoints: 27,
    theoryArgumentRaised: false,
    theoryArgumentWon: false,
  },
]);

const JONES: JudgeProfile = buildJudgeProfile("jones", [
  {
    judgeId: "jones",
    tournamentName: "Berkeley",
    date: "2026-01-01",
    division: "PF",
    winningSide: "neg",
    affSpeakerPoints: 26,
    negSpeakerPoints: 29,
    theoryArgumentRaised: false,
    theoryArgumentWon: false,
  },
]);

beforeEach(() => {
  (globalThis as unknown as { localStorage: MemoryStorage }).localStorage = new MemoryStorage();
});

describe("listJudgeProfiles", () => {
  it("returns an empty list when nothing is stored", () => {
    expect(listJudgeProfiles()).toEqual([]);
  });

  it("returns an empty list when the stored value is corrupt JSON", () => {
    localStorage.setItem("judgeProfiles", "{not json");
    expect(listJudgeProfiles()).toEqual([]);
  });

  it("returns an empty list when the stored value isn't an array", () => {
    localStorage.setItem("judgeProfiles", JSON.stringify({ not: "an array" }));
    expect(listJudgeProfiles()).toEqual([]);
  });

  it("lists every saved profile", () => {
    saveJudgeProfile(SMITH);
    saveJudgeProfile(JONES);
    expect(listJudgeProfiles()).toEqual([SMITH, JONES]);
  });
});

describe("getJudgeProfile", () => {
  it("finds a saved profile by judgeId", () => {
    saveJudgeProfile(SMITH);
    expect(getJudgeProfile("smith")).toEqual(SMITH);
  });

  it("returns undefined for a judgeId that isn't stored", () => {
    expect(getJudgeProfile("missing")).toBeUndefined();
  });
});

describe("saveJudgeProfile", () => {
  it("upserts — saving an existing judgeId overwrites rather than duplicating it", () => {
    saveJudgeProfile(SMITH);
    const revised = buildJudgeProfile("smith", [
      {
        judgeId: "smith",
        tournamentName: "Berkeley",
        date: "2026-01-01",
        division: "PF",
        winningSide: "aff",
        affSpeakerPoints: 28,
        negSpeakerPoints: 27,
        theoryArgumentRaised: false,
        theoryArgumentWon: false,
      },
      {
        judgeId: "smith",
        tournamentName: "Berkeley",
        date: "2026-01-02",
        division: "PF",
        winningSide: "neg",
        affSpeakerPoints: 27,
        negSpeakerPoints: 28,
        theoryArgumentRaised: false,
        theoryArgumentWon: false,
      },
    ]);
    saveJudgeProfile(revised);

    expect(listJudgeProfiles()).toEqual([revised]);
    expect(getJudgeProfile("smith")).toEqual(revised);
  });
});

describe("deleteJudgeProfile", () => {
  it("removes a stored profile by judgeId", () => {
    saveJudgeProfile(SMITH);
    saveJudgeProfile(JONES);
    deleteJudgeProfile("smith");

    expect(listJudgeProfiles()).toEqual([JONES]);
    expect(getJudgeProfile("smith")).toBeUndefined();
  });

  it("is a no-op when the judgeId isn't stored", () => {
    saveJudgeProfile(JONES);
    deleteJudgeProfile("missing");
    expect(listJudgeProfiles()).toEqual([JONES]);
  });
});
