import { beforeEach, describe, expect, it } from "vitest";
import {
  announceContributorAwards,
  buildPersistedTopContributorAwards,
  getAnnouncedContributorAwards,
  listAnnouncedContributorAwards,
} from "../src/state/contributorAwardAnnouncements";
import { saveContribution } from "../src/state/contributions";
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

const DAY_ONE = Date.parse("2026-08-10T12:00:00.000Z");
const DAY_ONE_LATER = Date.parse("2026-08-10T23:00:00.000Z");
const DAY_TWO = Date.parse("2026-08-11T09:00:00.000Z");

const aliceCard: AttributedContribution = {
  id: "alice-card",
  contributorId: "alice",
  kind: "card",
  likes: 5,
  saves: 3,
  qualitySignals: [0.9, 0.95],
  reviewerEndorsements: [{ reviewerWeight: 1 }],
};

const bobCard: AttributedContribution = {
  id: "bob-card",
  contributorId: "bob",
  kind: "card",
  likes: 0,
  saves: 0,
  qualitySignals: [0.2],
  reviewerEndorsements: [],
};

const carolSummary: AttributedContribution = {
  id: "carol-summary",
  contributorId: "carol",
  kind: "summary",
  likes: 2,
  saves: 2,
  qualitySignals: [0.8],
  reviewerEndorsements: [{ reviewerWeight: 0.7 }],
};

beforeEach(() => {
  (globalThis as unknown as { localStorage: MemoryStorage }).localStorage = new MemoryStorage();
});

describe("buildPersistedTopContributorAwards", () => {
  it("returns an empty list when nothing is stored", () => {
    expect(buildPersistedTopContributorAwards()).toEqual([]);
  });

  it("builds current award standings directly from persisted contributions", () => {
    saveContribution(aliceCard);
    saveContribution(carolSummary);

    const awards = buildPersistedTopContributorAwards();

    expect(awards.map((a) => a.kind)).toEqual(["card", "summary"]);
    expect(awards.map((a) => a.contributorId)).toEqual(["alice", "carol"]);
  });
});

describe("announceContributorAwards", () => {
  it("announces and persists the day's award standings", () => {
    saveContribution(aliceCard);
    saveContribution(bobCard);

    const announced = announceContributorAwards(DAY_ONE);

    expect(announced?.dayKey).toBe("2026-08-10");
    expect(announced?.awards[0].contributorId).toBe("alice");
    expect(getAnnouncedContributorAwards("2026-08-10")?.awards[0].contributorId).toBe("alice");
  });

  it("returns null and persists nothing when there are no contributions to award yet", () => {
    expect(announceContributorAwards(DAY_ONE)).toBeNull();
    expect(listAnnouncedContributorAwards()).toEqual([]);
  });

  it("is idempotent — a later same-day contribution does not change an already-announced result", () => {
    saveContribution(bobCard);
    const firstAnnouncement = announceContributorAwards(DAY_ONE_LATER);
    expect(firstAnnouncement?.awards[0].contributorId).toBe("bob");

    // A stronger card submitted the same UTC day, after the announcement.
    saveContribution(aliceCard);
    const secondAnnouncement = announceContributorAwards(DAY_ONE_LATER);

    expect(secondAnnouncement?.awards[0].contributorId).toBe("bob");
    expect(getAnnouncedContributorAwards("2026-08-10")?.awards[0].contributorId).toBe("bob");
  });
});

describe("listAnnouncedContributorAwards", () => {
  it("returns an empty list when nothing has been announced", () => {
    expect(listAnnouncedContributorAwards()).toEqual([]);
  });

  it("lists every announced day, sorted by dayKey ascending", () => {
    saveContribution(aliceCard);
    announceContributorAwards(DAY_TWO);
    announceContributorAwards(DAY_ONE);

    const announcements = listAnnouncedContributorAwards();

    expect(announcements.map((a) => a.dayKey)).toEqual(["2026-08-10", "2026-08-11"]);
  });
});

describe("getAnnouncedContributorAwards", () => {
  it("returns undefined for a day that hasn't been announced", () => {
    expect(getAnnouncedContributorAwards("2026-08-10")).toBeUndefined();
  });
});
