import { beforeEach, describe, expect, it } from "vitest";
import {
  deleteGroupChallenge,
  getGroupChallenge,
  listGroupChallenges,
  saveGroupChallenge,
} from "../src/state/groupChallenges";
import type { GroupChallenge } from "../src/lib/group-challenges";

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

const SOLVENCY_SPRINT: GroupChallenge = {
  id: "challenge-1",
  title: "Find 20 solvency cards this week",
  goal: { kind: "contribution_target", target: { kind: "card", argBlock: "solvency" }, targetCount: 20 },
  memberIds: ["alice", "bob"],
  startsAt: 0,
  endsAt: 604_800_000,
};
const REBUTTAL_CHALLENGE: GroupChallenge = {
  id: "challenge-2",
  title: "Win 5 rebuttal exercises",
  goal: { kind: "win_target", targetCount: 5 },
  memberIds: ["carol", "dave"],
  startsAt: 100,
  endsAt: 200,
};

beforeEach(() => {
  (globalThis as unknown as { localStorage: MemoryStorage }).localStorage = new MemoryStorage();
});

describe("listGroupChallenges", () => {
  it("returns an empty list when nothing is stored", () => {
    expect(listGroupChallenges()).toEqual([]);
  });

  it("returns an empty list when the stored value is corrupt JSON", () => {
    localStorage.setItem("groupChallenges", "{not json");
    expect(listGroupChallenges()).toEqual([]);
  });

  it("returns an empty list when the stored value isn't an array", () => {
    localStorage.setItem("groupChallenges", JSON.stringify({ not: "an array" }));
    expect(listGroupChallenges()).toEqual([]);
  });

  it("lists every saved challenge", () => {
    saveGroupChallenge(SOLVENCY_SPRINT);
    saveGroupChallenge(REBUTTAL_CHALLENGE);
    expect(listGroupChallenges()).toEqual([SOLVENCY_SPRINT, REBUTTAL_CHALLENGE]);
  });
});

describe("getGroupChallenge", () => {
  it("finds a saved challenge by id", () => {
    saveGroupChallenge(SOLVENCY_SPRINT);
    expect(getGroupChallenge("challenge-1")).toEqual(SOLVENCY_SPRINT);
  });

  it("returns undefined for an id that isn't stored", () => {
    expect(getGroupChallenge("missing")).toBeUndefined();
  });
});

describe("saveGroupChallenge", () => {
  it("upserts — saving an existing id overwrites rather than duplicating it", () => {
    saveGroupChallenge(SOLVENCY_SPRINT);
    const extended: GroupChallenge = { ...SOLVENCY_SPRINT, endsAt: 1_209_600_000 };
    saveGroupChallenge(extended);

    expect(listGroupChallenges()).toEqual([extended]);
    expect(getGroupChallenge("challenge-1")).toEqual(extended);
  });
});

describe("deleteGroupChallenge", () => {
  it("removes a stored challenge by id", () => {
    saveGroupChallenge(SOLVENCY_SPRINT);
    saveGroupChallenge(REBUTTAL_CHALLENGE);
    deleteGroupChallenge("challenge-1");

    expect(listGroupChallenges()).toEqual([REBUTTAL_CHALLENGE]);
    expect(getGroupChallenge("challenge-1")).toBeUndefined();
  });

  it("is a no-op when the id isn't stored", () => {
    saveGroupChallenge(REBUTTAL_CHALLENGE);
    deleteGroupChallenge("missing");
    expect(listGroupChallenges()).toEqual([REBUTTAL_CHALLENGE]);
  });
});
