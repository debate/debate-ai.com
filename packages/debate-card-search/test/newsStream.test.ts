import { beforeEach, describe, expect, it } from "vitest";
import {
  buildNewsFeed,
  countUnreadNewsItems,
  isNewsItemLiked,
  isNewsItemRead,
  markNewsItemRead,
  toggleNewsItemLiked,
} from "../src/state/newsStream";
import { PRODUCT_NEWS } from "../src/lib/news-stream";
import { saveDailyMissionResult } from "../src/state/dailyMissionResults";
import { saveGroupChallenge } from "../src/state/groupChallenges";
import { recordChallengeWinEvent } from "../src/state/challengeWinEvents";
import { saveRevisionRecord, type CardRevisionRecord } from "../src/state/revisionHistory";
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

beforeEach(() => {
  (globalThis as unknown as { localStorage: MemoryStorage }).localStorage = new MemoryStorage();
});

describe("buildNewsFeed", () => {
  it("returns just the hand-maintained product news when nothing else is persisted", () => {
    expect(buildNewsFeed()).toEqual(PRODUCT_NEWS.slice().sort((a, b) => b.timestamp - a.timestamp));
  });

  it("includes a contributor's freshly earned streak milestone as a community item", () => {
    saveDailyMissionResult({ contributorId: "alice", dayKey: "2026-08-08", isComplete: true });
    saveDailyMissionResult({ contributorId: "alice", dayKey: "2026-08-09", isComplete: true });
    saveDailyMissionResult({ contributorId: "alice", dayKey: "2026-08-10", isComplete: true });

    const item = buildNewsFeed().find((entry) => entry.id === "quest-streak-milestone-alice-2026-08-10");
    expect(item).toMatchObject({
      category: "community",
      title: 'alice earned "3-Day Streak"',
      href: "/cards/streaks",
    });
  });

  it("includes a completed group challenge as a community item", () => {
    const challenge: GroupChallenge = {
      id: "challenge-1",
      title: "Win 2 rebuttal exercises",
      goal: { kind: "win_target", targetCount: 2 },
      memberIds: ["carol"],
      startsAt: 0,
      endsAt: 1_000,
    };
    saveGroupChallenge(challenge);
    recordChallengeWinEvent("carol", 100);
    recordChallengeWinEvent("carol", 200);

    const item = buildNewsFeed().find((entry) => entry.id === "group-challenge-complete-challenge-1");
    expect(item).toMatchObject({
      category: "community",
      title: '"Win 2 rebuttal exercises" complete!',
      timestamp: 200,
      href: "/cards/group-challenges",
    });
  });

  it("includes a day's top Revision Incentives earner as a community item", () => {
    const revision: CardRevisionRecord = {
      id: "rev-1",
      cardId: "card-1",
      contributorId: "dana",
      revisedAt: "2026-08-10T00:00:00.000Z",
      before: { qualitySignals: [0.2, 0.2], citationCompleteness: 0.4, evidenceYear: 2018, wordCount: 200 },
      after: { qualitySignals: [0.9, 0.9], citationCompleteness: 0.4, evidenceYear: 2018, wordCount: 200 },
    };
    saveRevisionRecord(revision);

    const item = buildNewsFeed().find((entry) => entry.id === "revision-incentives-2026-08-10");
    expect(item).toMatchObject({ category: "community", href: "/cards/revisions" });
    expect(item?.body).toContain("dana led Revision Incentives on 2026-08-10");
  });

  it("sorts every category newest first together", () => {
    saveDailyMissionResult({ contributorId: "alice", dayKey: "2026-08-08", isComplete: true });
    saveDailyMissionResult({ contributorId: "alice", dayKey: "2026-08-09", isComplete: true });
    saveDailyMissionResult({ contributorId: "alice", dayKey: "2026-08-10", isComplete: true });

    const feed = buildNewsFeed();
    for (let i = 1; i < feed.length; i++) {
      expect(feed[i - 1].timestamp).toBeGreaterThanOrEqual(feed[i].timestamp);
    }
  });
});

describe("read/like viewer state", () => {
  it("starts with every item unread and unliked", () => {
    const [first] = PRODUCT_NEWS;
    expect(isNewsItemRead(first.id)).toBe(false);
    expect(isNewsItemLiked(first.id)).toBe(false);
  });

  it("marks an item read idempotently", () => {
    const [first] = PRODUCT_NEWS;
    markNewsItemRead(first.id);
    markNewsItemRead(first.id);
    expect(isNewsItemRead(first.id)).toBe(true);
  });

  it("toggles like state and returns the new state", () => {
    const [first] = PRODUCT_NEWS;
    expect(toggleNewsItemLiked(first.id)).toBe(true);
    expect(isNewsItemLiked(first.id)).toBe(true);
    expect(toggleNewsItemLiked(first.id)).toBe(false);
    expect(isNewsItemLiked(first.id)).toBe(false);
  });

  it("counts only items not yet marked read", () => {
    const items = PRODUCT_NEWS.slice(0, 2);
    expect(countUnreadNewsItems(items)).toBe(items.length);
    markNewsItemRead(items[0].id);
    expect(countUnreadNewsItems(items)).toBe(items.length - 1);
  });
});
