import { beforeEach, describe, expect, it } from "vitest";
import {
  deleteContribution,
  getContribution,
  listContributions,
  listContributionsByContributor,
  saveContribution,
} from "../src/state/contributions";
import type { AttributedContribution } from "../src/lib/contribution-leaderboard";

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

const ALICE_CARD: AttributedContribution = {
  id: "contrib-1",
  contributorId: "alice",
  kind: "card",
  likes: 12,
  saves: 4,
  qualitySignals: [0.8, 0.9],
  reviewerEndorsements: [{ reviewerWeight: 0.7 }],
};
const BOB_SUMMARY: AttributedContribution = {
  id: "contrib-2",
  contributorId: "bob",
  kind: "summary",
  likes: 3,
  saves: 1,
  qualitySignals: [0.5],
  reviewerEndorsements: [],
};

beforeEach(() => {
  (globalThis as unknown as { localStorage: MemoryStorage }).localStorage = new MemoryStorage();
});

describe("listContributions", () => {
  it("returns an empty list when nothing is stored", () => {
    expect(listContributions()).toEqual([]);
  });

  it("returns an empty list when the stored value is corrupt JSON", () => {
    localStorage.setItem("contributions", "{not json");
    expect(listContributions()).toEqual([]);
  });

  it("returns an empty list when the stored value isn't an array", () => {
    localStorage.setItem("contributions", JSON.stringify({ not: "an array" }));
    expect(listContributions()).toEqual([]);
  });

  it("lists every saved contribution across contributors", () => {
    saveContribution(ALICE_CARD);
    saveContribution(BOB_SUMMARY);
    expect(listContributions()).toEqual([ALICE_CARD, BOB_SUMMARY]);
  });
});

describe("listContributionsByContributor", () => {
  it("returns only contributions for the given contributor", () => {
    saveContribution(BOB_SUMMARY);
    saveContribution(ALICE_CARD);
    expect(listContributionsByContributor("alice")).toEqual([ALICE_CARD]);
    expect(listContributionsByContributor("bob")).toEqual([BOB_SUMMARY]);
  });

  it("returns an empty list for a contributor with no contributions", () => {
    saveContribution(ALICE_CARD);
    expect(listContributionsByContributor("carol")).toEqual([]);
  });
});

describe("getContribution", () => {
  it("finds a saved contribution by id", () => {
    saveContribution(ALICE_CARD);
    expect(getContribution("contrib-1")).toEqual(ALICE_CARD);
  });

  it("returns undefined for an id that isn't stored", () => {
    expect(getContribution("missing")).toBeUndefined();
  });
});

describe("saveContribution", () => {
  it("upserts — saving an existing id overwrites rather than duplicating it", () => {
    saveContribution(ALICE_CARD);
    const revised: AttributedContribution = { ...ALICE_CARD, likes: 20 };
    saveContribution(revised);

    expect(listContributions()).toEqual([revised]);
    expect(getContribution("contrib-1")).toEqual(revised);
  });
});

describe("deleteContribution", () => {
  it("removes a stored contribution by id", () => {
    saveContribution(ALICE_CARD);
    saveContribution(BOB_SUMMARY);
    deleteContribution("contrib-1");

    expect(listContributions()).toEqual([BOB_SUMMARY]);
    expect(getContribution("contrib-1")).toBeUndefined();
  });

  it("is a no-op when the id isn't stored", () => {
    saveContribution(BOB_SUMMARY);
    deleteContribution("missing");
    expect(listContributions()).toEqual([BOB_SUMMARY]);
  });
});
