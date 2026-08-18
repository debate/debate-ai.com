import { beforeEach, describe, expect, it } from "vitest";
import {
  announceDailyBestCard,
  buildPersistedDailyBestCards,
  getAnnouncedDailyBestCard,
  getPersistedBestCardForDay,
  listAnnouncedDailyBestCards,
} from "../src/state/dailyBestCardAnnouncements";
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

const strongCard: AttributedContribution = {
  id: "strong-card",
  contributorId: "alice",
  kind: "card",
  submittedAt: DAY_ONE,
  likes: 2,
  saves: 1,
  qualitySignals: [0.9, 0.95],
  reviewerEndorsements: [{ reviewerWeight: 1 }, { reviewerWeight: 0.9 }],
};

const weakCard: AttributedContribution = {
  id: "weak-card",
  contributorId: "bob",
  kind: "card",
  submittedAt: DAY_ONE_LATER,
  likes: 1,
  saves: 0,
  qualitySignals: [0.2],
  reviewerEndorsements: [],
};

const dayTwoCard: AttributedContribution = {
  id: "day-two-card",
  contributorId: "carol",
  kind: "card",
  submittedAt: DAY_TWO,
  likes: 0,
  saves: 0,
  qualitySignals: [0.5],
  reviewerEndorsements: [],
};

const undatedCard: AttributedContribution = {
  id: "undated-card",
  contributorId: "dave",
  kind: "card",
  likes: 999,
  saves: 999,
  qualitySignals: [1],
  reviewerEndorsements: [],
};

const summaryContribution: AttributedContribution = {
  id: "a-summary",
  contributorId: "erin",
  kind: "summary",
  submittedAt: DAY_ONE,
  likes: 999,
  saves: 999,
  qualitySignals: [1],
  reviewerEndorsements: [],
};

beforeEach(() => {
  (globalThis as unknown as { localStorage: MemoryStorage }).localStorage = new MemoryStorage();
});

describe("buildPersistedDailyBestCards", () => {
  it("returns an empty list when nothing is stored", () => {
    expect(buildPersistedDailyBestCards()).toEqual([]);
  });

  it("picks one winner per represented day from persisted card contributions", () => {
    saveContribution(strongCard);
    saveContribution(weakCard);
    saveContribution(dayTwoCard);

    const results = buildPersistedDailyBestCards();

    expect(results.map((r) => r.dayKey)).toEqual(["2026-08-10", "2026-08-11"]);
    expect(results[0].contribution.id).toBe("strong-card");
    expect(results[1].contribution.id).toBe("day-two-card");
  });

  it("ignores contributions of a kind other than card", () => {
    saveContribution(summaryContribution);
    expect(buildPersistedDailyBestCards()).toEqual([]);
  });

  it("ignores card contributions with no submittedAt timestamp", () => {
    saveContribution(undatedCard);
    expect(buildPersistedDailyBestCards()).toEqual([]);
  });
});

describe("getPersistedBestCardForDay", () => {
  it("returns the live winner for the UTC day of `now`", () => {
    saveContribution(strongCard);
    saveContribution(weakCard);

    const result = getPersistedBestCardForDay(DAY_ONE_LATER);

    expect(result?.dayKey).toBe("2026-08-10");
    expect(result?.contribution.id).toBe("strong-card");
  });

  it("returns null when no card was submitted that day", () => {
    saveContribution(dayTwoCard);
    expect(getPersistedBestCardForDay(DAY_ONE)).toBeNull();
  });
});

describe("announceDailyBestCard", () => {
  it("announces and persists the day's winner", () => {
    saveContribution(strongCard);
    saveContribution(weakCard);

    const announced = announceDailyBestCard(DAY_ONE);

    expect(announced?.contribution.id).toBe("strong-card");
    expect(getAnnouncedDailyBestCard("2026-08-10")?.contribution.id).toBe("strong-card");
  });

  it("returns null and persists nothing when the day has no card contributions", () => {
    expect(announceDailyBestCard(DAY_ONE)).toBeNull();
    expect(listAnnouncedDailyBestCards()).toEqual([]);
  });

  it("is idempotent — a later, stronger same-day submission does not change an already-announced winner", () => {
    saveContribution(weakCard);
    const firstAnnouncement = announceDailyBestCard(DAY_ONE_LATER);
    expect(firstAnnouncement?.contribution.id).toBe("weak-card");

    // A stronger card submitted the same UTC day, after the announcement.
    saveContribution(strongCard);
    const secondAnnouncement = announceDailyBestCard(DAY_ONE_LATER);

    expect(secondAnnouncement?.contribution.id).toBe("weak-card");
    expect(getAnnouncedDailyBestCard("2026-08-10")?.contribution.id).toBe("weak-card");
  });
});

describe("listAnnouncedDailyBestCards", () => {
  it("returns an empty list when nothing has been announced", () => {
    expect(listAnnouncedDailyBestCards()).toEqual([]);
  });

  it("lists every announced day, sorted by dayKey ascending", () => {
    saveContribution(dayTwoCard);
    saveContribution(strongCard);
    announceDailyBestCard(DAY_TWO);
    announceDailyBestCard(DAY_ONE);

    const announcements = listAnnouncedDailyBestCards();

    expect(announcements.map((a) => a.dayKey)).toEqual(["2026-08-10", "2026-08-11"]);
  });
});

describe("getAnnouncedDailyBestCard", () => {
  it("returns undefined for a day that hasn't been announced", () => {
    expect(getAnnouncedDailyBestCard("2026-08-10")).toBeUndefined();
  });
});
