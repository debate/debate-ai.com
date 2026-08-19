import { beforeEach, describe, expect, it } from "vitest";
import {
  assignRoundToContributor,
  listRoundContributorAssignments,
  unassignRoundFromContributor,
} from "../src/state/roundContributorAssignments";
import type { RoundContributorAssignment } from "../src/round/coaching-program";

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

const ALEX_TO_ROUND_1: RoundContributorAssignment = { programId: "varsity", contributorId: "alex", roundId: "round-1" };
const SAM_TO_ROUND_2: RoundContributorAssignment = { programId: "varsity", contributorId: "sam", roundId: "round-2" };
const ALEX_TO_ROUND_9_JV: RoundContributorAssignment = { programId: "jv", contributorId: "alex", roundId: "round-9" };

beforeEach(() => {
  (globalThis as unknown as { localStorage: MemoryStorage }).localStorage = new MemoryStorage();
});

describe("listRoundContributorAssignments", () => {
  it("returns an empty list when nothing is stored", () => {
    expect(listRoundContributorAssignments("varsity")).toEqual([]);
  });

  it("returns an empty list when the stored value is corrupt JSON", () => {
    localStorage.setItem("roundContributorAssignments", "{not json");
    expect(listRoundContributorAssignments("varsity")).toEqual([]);
  });

  it("returns an empty list when the stored value isn't an array", () => {
    localStorage.setItem("roundContributorAssignments", JSON.stringify({ not: "an array" }));
    expect(listRoundContributorAssignments("varsity")).toEqual([]);
  });

  it("scopes results to the given programId", () => {
    assignRoundToContributor(ALEX_TO_ROUND_1);
    assignRoundToContributor(ALEX_TO_ROUND_9_JV);

    expect(listRoundContributorAssignments("varsity")).toEqual([ALEX_TO_ROUND_1]);
    expect(listRoundContributorAssignments("jv")).toEqual([ALEX_TO_ROUND_9_JV]);
  });
});

describe("assignRoundToContributor", () => {
  it("adds a new assignment", () => {
    assignRoundToContributor(ALEX_TO_ROUND_1);
    assignRoundToContributor(SAM_TO_ROUND_2);

    expect(listRoundContributorAssignments("varsity")).toEqual([ALEX_TO_ROUND_1, SAM_TO_ROUND_2]);
  });

  it("upserts — reassigning a contributor within the same program replaces their prior assignment", () => {
    assignRoundToContributor(ALEX_TO_ROUND_1);
    const reassigned: RoundContributorAssignment = { programId: "varsity", contributorId: "alex", roundId: "round-3" };
    assignRoundToContributor(reassigned);

    expect(listRoundContributorAssignments("varsity")).toEqual([reassigned]);
  });

  it("keeps the same contributor's assignments in different programs independent", () => {
    assignRoundToContributor(ALEX_TO_ROUND_1);
    assignRoundToContributor(ALEX_TO_ROUND_9_JV);

    expect(listRoundContributorAssignments("varsity")).toEqual([ALEX_TO_ROUND_1]);
    expect(listRoundContributorAssignments("jv")).toEqual([ALEX_TO_ROUND_9_JV]);
  });
});

describe("unassignRoundFromContributor", () => {
  it("removes a contributor's assignment within a program", () => {
    assignRoundToContributor(ALEX_TO_ROUND_1);
    assignRoundToContributor(SAM_TO_ROUND_2);
    unassignRoundFromContributor("varsity", "alex");

    expect(listRoundContributorAssignments("varsity")).toEqual([SAM_TO_ROUND_2]);
  });

  it("is a no-op when the contributor has no assignment in that program", () => {
    assignRoundToContributor(SAM_TO_ROUND_2);
    unassignRoundFromContributor("varsity", "alex");

    expect(listRoundContributorAssignments("varsity")).toEqual([SAM_TO_ROUND_2]);
  });

  it("does not affect the same contributor's assignment in a different program", () => {
    assignRoundToContributor(ALEX_TO_ROUND_1);
    assignRoundToContributor(ALEX_TO_ROUND_9_JV);
    unassignRoundFromContributor("varsity", "alex");

    expect(listRoundContributorAssignments("varsity")).toEqual([]);
    expect(listRoundContributorAssignments("jv")).toEqual([ALEX_TO_ROUND_9_JV]);
  });
});
