import { beforeEach, describe, expect, it } from "vitest";
import {
  InvalidNominationSecondError,
  InvalidPeerNominationError,
  MAX_NOMINATION_NOTE_LENGTH,
  adoptPeerNomination,
  deletePeerNomination,
  listAllPeerNominations,
  listPeerNominationsForKind,
  secondPeerNomination,
  submitPeerNomination,
} from "../src/state/contributorAwardNominations";
import type { PeerNomination } from "../src/lib/contributor-awards";

/** Minimal in-memory `localStorage` mock — this package's Vitest environment has no DOM by default. */
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

function makeNomination(overrides: Partial<PeerNomination> = {}): PeerNomination {
  return {
    id: "nom-1700000000000-ab12cd",
    kind: "card",
    nomineeId: "alice",
    nominatorId: "bob",
    nominatedAt: 1700000000000,
    ...overrides,
  };
}

describe("submitPeerNomination", () => {
  it("assigns a fresh id and persists the nomination", () => {
    const nomination = submitPeerNomination({ kind: "card", nomineeId: "alice", nominatorId: "bob" });
    expect(nomination.id).toBeTruthy();
    expect(nomination.kind).toBe("card");
    expect(nomination.nomineeId).toBe("alice");
    expect(nomination.nominatorId).toBe("bob");
    expect(nomination.note).toBeUndefined();
    expect(listAllPeerNominations()).toEqual([nomination]);
  });

  it("trims nomineeId, nominatorId, and note", () => {
    const nomination = submitPeerNomination({
      kind: "card",
      nomineeId: "  alice  ",
      nominatorId: "  bob  ",
      note: "  great cards  ",
    });
    expect(nomination.nomineeId).toBe("alice");
    expect(nomination.nominatorId).toBe("bob");
    expect(nomination.note).toBe("great cards");
  });

  it("omits note entirely when blank", () => {
    const nomination = submitPeerNomination({ kind: "card", nomineeId: "alice", nominatorId: "bob", note: "   " });
    expect(nomination.note).toBeUndefined();
  });

  it("caps note at MAX_NOMINATION_NOTE_LENGTH", () => {
    const longNote = "x".repeat(MAX_NOMINATION_NOTE_LENGTH + 50);
    const nomination = submitPeerNomination({ kind: "card", nomineeId: "alice", nominatorId: "bob", note: longNote });
    expect(nomination.note).toHaveLength(MAX_NOMINATION_NOTE_LENGTH);
  });

  it("throws InvalidPeerNominationError when nominating yourself", () => {
    expect(() => submitPeerNomination({ kind: "card", nomineeId: "alice", nominatorId: "alice" })).toThrow(
      InvalidPeerNominationError,
    );
  });

  it("throws InvalidPeerNominationError for a blank nominee or nominator", () => {
    expect(() => submitPeerNomination({ kind: "card", nomineeId: "  ", nominatorId: "bob" })).toThrow(
      InvalidPeerNominationError,
    );
    expect(() => submitPeerNomination({ kind: "card", nomineeId: "alice", nominatorId: "  " })).toThrow(
      InvalidPeerNominationError,
    );
  });

  it("does not persist a rejected nomination", () => {
    expect(() => submitPeerNomination({ kind: "card", nomineeId: "alice", nominatorId: "alice" })).toThrow();
    expect(listAllPeerNominations()).toEqual([]);
  });

  it("assigns distinct ids to two nominations submitted back to back", () => {
    const first = submitPeerNomination({ kind: "card", nomineeId: "alice", nominatorId: "bob" });
    const second = submitPeerNomination({ kind: "card", nomineeId: "carol", nominatorId: "bob" });
    expect(first.id).not.toBe(second.id);
  });
});

describe("listAllPeerNominations", () => {
  it("returns an empty list when nothing has been submitted", () => {
    expect(listAllPeerNominations()).toEqual([]);
  });

  it("returns nominations newest first regardless of insertion order", () => {
    adoptPeerNomination(makeNomination({ id: "n1", nominatedAt: 1000 }));
    adoptPeerNomination(makeNomination({ id: "n2", nominatedAt: 3000 }));
    adoptPeerNomination(makeNomination({ id: "n3", nominatedAt: 2000 }));
    expect(listAllPeerNominations().map((n) => n.id)).toEqual(["n2", "n3", "n1"]);
  });
});

describe("listPeerNominationsForKind", () => {
  it("filters to just one category, newest first", () => {
    adoptPeerNomination(makeNomination({ id: "n1", kind: "card", nominatedAt: 1000 }));
    adoptPeerNomination(makeNomination({ id: "n2", kind: "summary", nominatedAt: 2000 }));
    adoptPeerNomination(makeNomination({ id: "n3", kind: "card", nominatedAt: 3000 }));
    expect(listPeerNominationsForKind("card").map((n) => n.id)).toEqual(["n3", "n1"]);
  });

  it("returns an empty list for a kind with no nominations", () => {
    adoptPeerNomination(makeNomination({ id: "n1", kind: "card" }));
    expect(listPeerNominationsForKind("annotation")).toEqual([]);
  });
});

describe("adoptPeerNomination", () => {
  it("inserts a nomination not already stored", () => {
    adoptPeerNomination(makeNomination({ id: "n1" }));
    expect(listAllPeerNominations()).toHaveLength(1);
  });

  it("overwrites an existing nomination with the same id instead of duplicating it", () => {
    adoptPeerNomination(makeNomination({ id: "n1", note: "first" }));
    adoptPeerNomination(makeNomination({ id: "n1", note: "updated" }));
    const all = listAllPeerNominations();
    expect(all).toHaveLength(1);
    expect(all[0].note).toBe("updated");
  });
});

describe("secondPeerNomination", () => {
  it("appends the seconder to the nomination's seconderIds", () => {
    adoptPeerNomination(makeNomination({ id: "n1", nomineeId: "alice", nominatorId: "bob" }));
    const updated = secondPeerNomination("n1", "carol");
    expect(updated.seconderIds).toEqual(["carol"]);
    expect(listAllPeerNominations()[0].seconderIds).toEqual(["carol"]);
  });

  it("trims the seconder id before storing it", () => {
    adoptPeerNomination(makeNomination({ id: "n1", nomineeId: "alice", nominatorId: "bob" }));
    const updated = secondPeerNomination("n1", "  carol  ");
    expect(updated.seconderIds).toEqual(["carol"]);
  });

  it("accumulates multiple distinct seconders", () => {
    adoptPeerNomination(makeNomination({ id: "n1", nomineeId: "alice", nominatorId: "bob" }));
    secondPeerNomination("n1", "carol");
    secondPeerNomination("n1", "dave");
    expect(listAllPeerNominations()[0].seconderIds).toEqual(["carol", "dave"]);
  });

  it("throws InvalidNominationSecondError for an unknown nomination id", () => {
    expect(() => secondPeerNomination("missing", "carol")).toThrow(InvalidNominationSecondError);
  });

  it("throws InvalidNominationSecondError when the nominee tries to second their own nomination", () => {
    adoptPeerNomination(makeNomination({ id: "n1", nomineeId: "alice", nominatorId: "bob" }));
    expect(() => secondPeerNomination("n1", "alice")).toThrow(InvalidNominationSecondError);
  });

  it("throws InvalidNominationSecondError when the nominator tries to second their own nomination again", () => {
    adoptPeerNomination(makeNomination({ id: "n1", nomineeId: "alice", nominatorId: "bob" }));
    expect(() => secondPeerNomination("n1", "bob")).toThrow(InvalidNominationSecondError);
  });

  it("throws InvalidNominationSecondError for a blank seconder", () => {
    adoptPeerNomination(makeNomination({ id: "n1", nomineeId: "alice", nominatorId: "bob" }));
    expect(() => secondPeerNomination("n1", "   ")).toThrow(InvalidNominationSecondError);
  });

  it("throws InvalidNominationSecondError for a duplicate second", () => {
    adoptPeerNomination(makeNomination({ id: "n1", nomineeId: "alice", nominatorId: "bob" }));
    secondPeerNomination("n1", "carol");
    expect(() => secondPeerNomination("n1", "carol")).toThrow(InvalidNominationSecondError);
    expect(() => secondPeerNomination("n1", " Carol ")).toThrow(InvalidNominationSecondError);
  });

  it("does not mutate other nominations", () => {
    adoptPeerNomination(makeNomination({ id: "n1", nomineeId: "alice", nominatorId: "bob" }));
    adoptPeerNomination(makeNomination({ id: "n2", nomineeId: "carol", nominatorId: "dave" }));
    secondPeerNomination("n1", "erin");
    const all = listAllPeerNominations();
    expect(all.find((n) => n.id === "n2")?.seconderIds).toBeUndefined();
  });
});

describe("deletePeerNomination", () => {
  it("removes a persisted nomination by id", () => {
    adoptPeerNomination(makeNomination({ id: "n1" }));
    adoptPeerNomination(makeNomination({ id: "n2" }));
    deletePeerNomination("n1");
    expect(listAllPeerNominations().map((n) => n.id)).toEqual(["n2"]);
  });

  it("is a no-op for an id that isn't stored", () => {
    adoptPeerNomination(makeNomination({ id: "n1" }));
    expect(() => deletePeerNomination("missing")).not.toThrow();
    expect(listAllPeerNominations()).toHaveLength(1);
  });
});
