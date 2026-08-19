import { beforeEach, describe, expect, it } from "vitest";
import {
  deleteMemberRoundLink,
  deleteMemberRoundLinksForProgram,
  getMemberRoundLink,
  listMemberRoundLinks,
  saveMemberRoundLink,
  type MemberRoundLink,
} from "../src/state/coachingProgramMemberRounds";

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

const ALICE_LINK: MemberRoundLink = { programId: "varsity", memberId: "alice", roundId: "round-1" };
const BOB_LINK: MemberRoundLink = { programId: "varsity", memberId: "bob", roundId: "round-2" };
const CAROL_LINK: MemberRoundLink = { programId: "jv", memberId: "carol", roundId: "round-3" };

beforeEach(() => {
  (globalThis as unknown as { localStorage: MemoryStorage }).localStorage = new MemoryStorage();
});

describe("listMemberRoundLinks", () => {
  it("returns an empty list when nothing is stored", () => {
    expect(listMemberRoundLinks("varsity")).toEqual([]);
  });

  it("returns an empty list when the stored value is corrupt JSON", () => {
    localStorage.setItem("coachingProgramMemberRounds", "{not json");
    expect(listMemberRoundLinks("varsity")).toEqual([]);
  });

  it("returns an empty list when the stored value isn't an array", () => {
    localStorage.setItem("coachingProgramMemberRounds", JSON.stringify({ not: "an array" }));
    expect(listMemberRoundLinks("varsity")).toEqual([]);
  });

  it("scopes results to the given programId", () => {
    saveMemberRoundLink(ALICE_LINK);
    saveMemberRoundLink(BOB_LINK);
    saveMemberRoundLink(CAROL_LINK);

    expect(listMemberRoundLinks("varsity")).toEqual([ALICE_LINK, BOB_LINK]);
    expect(listMemberRoundLinks("jv")).toEqual([CAROL_LINK]);
  });
});

describe("getMemberRoundLink", () => {
  it("finds a saved link by (programId, memberId)", () => {
    saveMemberRoundLink(ALICE_LINK);
    expect(getMemberRoundLink("varsity", "alice")).toEqual(ALICE_LINK);
  });

  it("returns undefined when no link is stored for that pair", () => {
    expect(getMemberRoundLink("varsity", "alice")).toBeUndefined();
  });

  it("does not cross-match the same memberId under a different programId", () => {
    saveMemberRoundLink(ALICE_LINK);
    expect(getMemberRoundLink("jv", "alice")).toBeUndefined();
  });
});

describe("saveMemberRoundLink", () => {
  it("upserts — saving an existing (programId, memberId) pair overwrites rather than duplicating it", () => {
    saveMemberRoundLink(ALICE_LINK);
    const relinked: MemberRoundLink = { ...ALICE_LINK, roundId: "round-9" };
    saveMemberRoundLink(relinked);

    expect(listMemberRoundLinks("varsity")).toEqual([relinked]);
    expect(getMemberRoundLink("varsity", "alice")).toEqual(relinked);
  });
});

describe("deleteMemberRoundLink", () => {
  it("removes a stored link by (programId, memberId)", () => {
    saveMemberRoundLink(ALICE_LINK);
    saveMemberRoundLink(BOB_LINK);
    deleteMemberRoundLink("varsity", "alice");

    expect(listMemberRoundLinks("varsity")).toEqual([BOB_LINK]);
    expect(getMemberRoundLink("varsity", "alice")).toBeUndefined();
  });

  it("is a no-op when the pair isn't stored", () => {
    saveMemberRoundLink(BOB_LINK);
    deleteMemberRoundLink("varsity", "missing");
    expect(listMemberRoundLinks("varsity")).toEqual([BOB_LINK]);
  });
});

describe("deleteMemberRoundLinksForProgram", () => {
  it("removes every link for a program, leaving other programs' links untouched", () => {
    saveMemberRoundLink(ALICE_LINK);
    saveMemberRoundLink(BOB_LINK);
    saveMemberRoundLink(CAROL_LINK);
    deleteMemberRoundLinksForProgram("varsity");

    expect(listMemberRoundLinks("varsity")).toEqual([]);
    expect(listMemberRoundLinks("jv")).toEqual([CAROL_LINK]);
  });

  it("is a no-op when the program has no links", () => {
    saveMemberRoundLink(CAROL_LINK);
    deleteMemberRoundLinksForProgram("varsity");
    expect(listMemberRoundLinks("jv")).toEqual([CAROL_LINK]);
  });
});
