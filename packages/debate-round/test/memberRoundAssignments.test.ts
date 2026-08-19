import { beforeEach, describe, expect, it } from "vitest";
import {
  deleteMemberRoundAssignment,
  getMemberRoundAssignment,
  listAllMemberRoundAssignments,
  listMemberRoundAssignments,
  saveMemberRoundAssignment,
} from "../src/state/memberRoundAssignments";

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

beforeEach(() => {
  (globalThis as unknown as { localStorage: MemoryStorage }).localStorage = new MemoryStorage();
});

describe("memberRoundAssignments", () => {
  it("returns an empty list when nothing is stored", () => {
    expect(listAllMemberRoundAssignments()).toEqual([]);
    expect(listMemberRoundAssignments("varsity")).toEqual([]);
  });

  it("degrades corrupt or non-array storage to an empty list rather than throwing", () => {
    localStorage.setItem("memberRoundAssignments", "not json");
    expect(listAllMemberRoundAssignments()).toEqual([]);

    localStorage.setItem("memberRoundAssignments", JSON.stringify({ not: "an array" }));
    expect(listAllMemberRoundAssignments()).toEqual([]);
  });

  it("saves and looks up a member's round assignment", () => {
    saveMemberRoundAssignment({ programId: "varsity", contributorId: "alice", roundId: "42", sideKey: "aff" });
    expect(getMemberRoundAssignment("varsity", "alice")).toEqual({
      programId: "varsity",
      contributorId: "alice",
      roundId: "42",
      sideKey: "aff",
    });
    expect(getMemberRoundAssignment("varsity", "bob")).toBeUndefined();
  });

  it("scopes assignments per (programId, contributorId) pair — the same member can differ across programs", () => {
    saveMemberRoundAssignment({ programId: "varsity", contributorId: "alice", roundId: "42", sideKey: "aff" });
    saveMemberRoundAssignment({ programId: "jv", contributorId: "alice", roundId: "7", sideKey: "neg" });

    expect(getMemberRoundAssignment("varsity", "alice")?.roundId).toBe("42");
    expect(getMemberRoundAssignment("jv", "alice")?.roundId).toBe("7");
    expect(listMemberRoundAssignments("varsity")).toHaveLength(1);
  });

  it("overwrites an existing assignment for the same (programId, contributorId) pair", () => {
    saveMemberRoundAssignment({ programId: "varsity", contributorId: "alice", roundId: "42", sideKey: "aff" });
    saveMemberRoundAssignment({ programId: "varsity", contributorId: "alice", roundId: "99", sideKey: "neg" });

    expect(listAllMemberRoundAssignments()).toHaveLength(1);
    expect(getMemberRoundAssignment("varsity", "alice")).toEqual({
      programId: "varsity",
      contributorId: "alice",
      roundId: "99",
      sideKey: "neg",
    });
  });

  it("deletes a member's assignment; a no-op when nothing is stored for it", () => {
    saveMemberRoundAssignment({ programId: "varsity", contributorId: "alice", roundId: "42", sideKey: "aff" });
    deleteMemberRoundAssignment("varsity", "bob");
    expect(listAllMemberRoundAssignments()).toHaveLength(1);

    deleteMemberRoundAssignment("varsity", "alice");
    expect(listAllMemberRoundAssignments()).toEqual([]);
  });
});
