import { beforeEach, describe, expect, it } from "vitest";
import {
  clearMemberPracticeRound,
  getMemberRoundIds,
  setMemberPracticeRound,
  buildCoachingProgramMemberPracticeRoundsFromStores,
} from "../src/state/coachingProgramMemberRounds";
import { savePracticeRound } from "../src/state/practiceRounds";
import { buildPracticeRoundSetup } from "../src/round/practice-round-simulator";
import type { CoachingProgramConfig } from "../src/round/coaching-program";
import type { PracticeRoundRecord } from "../src/state/practiceRounds";

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

const program: CoachingProgramConfig = {
  id: "varsity",
  name: "Varsity Squad",
  memberIds: ["alex", "sam"],
};

const setup = buildPracticeRoundSetup({ styleKey: "lincolnDouglas", judgeParadigm: "lay" });
const roundA: PracticeRoundRecord = { roundId: "round-1", setup };

beforeEach(() => {
  (globalThis as unknown as { localStorage: MemoryStorage }).localStorage = new MemoryStorage();
});

describe("getMemberRoundIds", () => {
  it("returns an empty object when nothing is stored", () => {
    expect(getMemberRoundIds("varsity")).toEqual({});
  });

  it("returns an empty object when the stored value is corrupt JSON", () => {
    localStorage.setItem("coachingProgramMemberRounds", "{not json");
    expect(getMemberRoundIds("varsity")).toEqual({});
  });

  it("returns an empty object when the stored value isn't an object", () => {
    localStorage.setItem("coachingProgramMemberRounds", JSON.stringify(["not", "an", "object"]));
    expect(getMemberRoundIds("varsity")).toEqual({});
  });

  it("returns an empty object for a program with no assignments stored", () => {
    setMemberPracticeRound("varsity", "alex", "round-1");
    expect(getMemberRoundIds("jv")).toEqual({});
  });
});

describe("setMemberPracticeRound", () => {
  it("assigns a member's round within a program", () => {
    setMemberPracticeRound("varsity", "alex", "round-1");
    expect(getMemberRoundIds("varsity")).toEqual({ alex: "round-1" });
  });

  it("reassigns without clobbering other members' assignments in the same program", () => {
    setMemberPracticeRound("varsity", "alex", "round-1");
    setMemberPracticeRound("varsity", "sam", "round-2");
    setMemberPracticeRound("varsity", "alex", "round-3");

    expect(getMemberRoundIds("varsity")).toEqual({ alex: "round-3", sam: "round-2" });
  });

  it("keeps assignments scoped per program", () => {
    setMemberPracticeRound("varsity", "alex", "round-1");
    setMemberPracticeRound("jv", "alex", "round-9");

    expect(getMemberRoundIds("varsity")).toEqual({ alex: "round-1" });
    expect(getMemberRoundIds("jv")).toEqual({ alex: "round-9" });
  });
});

describe("clearMemberPracticeRound", () => {
  it("removes a member's assignment", () => {
    setMemberPracticeRound("varsity", "alex", "round-1");
    setMemberPracticeRound("varsity", "sam", "round-2");
    clearMemberPracticeRound("varsity", "alex");

    expect(getMemberRoundIds("varsity")).toEqual({ sam: "round-2" });
  });

  it("is a no-op when the member has no assignment", () => {
    setMemberPracticeRound("varsity", "sam", "round-2");
    clearMemberPracticeRound("varsity", "alex");
    expect(getMemberRoundIds("varsity")).toEqual({ sam: "round-2" });
  });
});

describe("buildCoachingProgramMemberPracticeRoundsFromStores", () => {
  it("composes a program's persisted assignments against the real practiceRounds store", () => {
    savePracticeRound(roundA);
    setMemberPracticeRound("varsity", "alex", "round-1");

    const views = buildCoachingProgramMemberPracticeRoundsFromStores(program);

    expect(views).toHaveLength(1);
    expect(views[0]).toMatchObject({ contributorId: "alex", roundId: "round-1", feedbackText: null });
  });

  it("returns an empty list when the program has no assignments", () => {
    expect(buildCoachingProgramMemberPracticeRoundsFromStores(program)).toEqual([]);
  });

  it("skips an assignment whose round isn't (or is no longer) persisted", () => {
    setMemberPracticeRound("varsity", "alex", "round-missing");
    expect(buildCoachingProgramMemberPracticeRoundsFromStores(program)).toEqual([]);
  });
});
