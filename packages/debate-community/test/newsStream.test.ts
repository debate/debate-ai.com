import { beforeEach, describe, expect, it } from "vitest";
import {
  buildNewsFeed,
  countUnreadNewsItems,
  isNewsItemLiked,
  isNewsItemRead,
  listLikedIds,
  listReadIds,
  markNewsItemRead,
  mergeRemoteViewerState,
  toggleNewsItemLiked,
} from "../src/state/newsStream";
import { PRODUCT_NEWS, buildAutoFeatureNews, sortNewsFeed } from "../src/lib/news-stream";
import { APP_FEATURES } from "../src/ui/features/feature-catalog";
import { saveDailyMissionResult } from "../src/state/dailyMissionResults";
import { saveGroupChallenge } from "debate-team-collaboration/src/state/groupChallenges";
import { recordChallengeWinEvent } from "debate-team-collaboration/src/state/challengeWinEvents";
import { saveRevisionRecord, type CardRevisionRecord } from "debate-research-evidence/src/state/revisionHistory";
import { saveSprintNote } from "debate-team-collaboration/src/state/sprintNotes";
import { saveEvidenceLibraryEntry } from "debate-research-evidence/src/state/evidenceLibraryEntries";
import type { GroupChallenge } from "debate-team-collaboration/src/lib/group-challenges";
import type { SprintNote } from "debate-team-collaboration/src/lib/team-collaboration-mode";
import type { EvidenceLibraryEntry } from "debate-research-evidence/src/lib/shared-evidence-library";

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

describe("buildAutoFeatureNews", () => {
  it("skips a feature whose href a hand-curated item already covers", () => {
    const items = buildAutoFeatureNews(
      [{ id: "reason-editor", title: "Reason Editor", description: "...", href: "/reason-editor", category: "workspaces" }],
      [{ id: "p1", category: "product", title: "Ship", body: "...", timestamp: 1000, href: "/reason-editor" }],
    );
    expect(items).toEqual([]);
  });

  it("spotlights a feature no hand-curated item covers", () => {
    const items = buildAutoFeatureNews(
      [{ id: "drills", title: "Practice Drills", description: "Quick practice drills.", href: "/drills", category: "practice" }],
      [{ id: "p1", category: "product", title: "Ship", body: "...", timestamp: 1000, href: "/reason-editor" }],
    );
    expect(items).toEqual([
      {
        id: "auto-feature-drills",
        category: "product",
        title: "Tool spotlight: Practice Drills",
        body: "Quick practice drills.",
        timestamp: 999,
        href: "/drills",
      },
    ]);
  });

  it("sorts every spotlight below the oldest hand-curated item, regardless of announced order", () => {
    const announced = [
      { id: "p1", category: "product" as const, title: "Ship", body: "...", timestamp: 5000, href: "/a" },
      { id: "p2", category: "product" as const, title: "Ship 2", body: "...", timestamp: 1000, href: "/b" },
    ];
    const [spotlight] = buildAutoFeatureNews(
      [{ id: "drills", title: "Practice Drills", description: "...", href: "/drills", category: "practice" }],
      announced,
    );
    expect(spotlight.timestamp).toBeLessThan(1000);
  });

  it("finds every real APP_FEATURES entry an uncovered href against the real PRODUCT_NEWS list", () => {
    const items = buildAutoFeatureNews();
    // Every real catalog entry not already covered by a hand-curated href gets exactly one spotlight.
    const coveredHrefs = new Set(PRODUCT_NEWS.map((item) => item.href));
    const expectedCount = APP_FEATURES.filter((feature) => !coveredHrefs.has(feature.href)).length;
    expect(items).toHaveLength(expectedCount);
    expect(items.every((item) => item.category === "product")).toBe(true);
    expect(new Set(items.map((item) => item.id)).size).toBe(items.length);
  });
});

describe("buildNewsFeed", () => {
  it("returns the hand-maintained product news plus an auto tool spotlight for every uncovered catalog entry when nothing else is persisted", () => {
    expect(buildNewsFeed()).toEqual(sortNewsFeed([...PRODUCT_NEWS, ...buildAutoFeatureNews()]));
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

  it("includes a contributor's completed Daily Quests day as a community item", () => {
    saveDailyMissionResult({ contributorId: "frank", dayKey: "2026-08-11", isComplete: true });

    const item = buildNewsFeed().find((entry) => entry.id === "daily-quest-complete-frank-2026-08-11");
    expect(item).toMatchObject({
      category: "community",
      title: "frank completed the Daily Quests board for 2026-08-11",
      timestamp: Date.parse("2026-08-11T00:00:00Z"),
      href: "/cards/quests",
    });
    expect(item?.body).toBe("frank completed every quest on the Daily Quests board for 2026-08-11!");
  });

  it("omits an incomplete Daily Quests day", () => {
    saveDailyMissionResult({ contributorId: "frank", dayKey: "2026-08-11", isComplete: false });
    expect(buildNewsFeed().find((entry) => entry.id === "daily-quest-complete-frank-2026-08-11")).toBeUndefined();
  });

  it("caps completed Daily Quests days to the most recent MAX_COMMUNITY_ITEMS_PER_SOURCE, dropping older ones", () => {
    for (let i = 0; i < 25; i++) {
      const day = `2026-08-${String(i + 1).padStart(2, "0")}`;
      saveDailyMissionResult({ contributorId: "frank", dayKey: day, isComplete: true });
    }

    const feed = buildNewsFeed();
    const completionItems = feed.filter((item) => item.id.startsWith("daily-quest-complete-"));
    expect(completionItems).toHaveLength(20);
    expect(feed.find((item) => item.id === "daily-quest-complete-frank-2026-08-25")).toBeDefined();
    expect(feed.find((item) => item.id === "daily-quest-complete-frank-2026-08-05")).toBeUndefined();
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

  it("includes a logged Team Collaboration Mode prep note as a community item", () => {
    const note: SprintNote = {
      id: "note-1",
      topic: "Immigration",
      authorId: "erin",
      text: "Need a 2026 solvency card for the affirmative",
      status: "open",
      createdAt: 500,
      updatedAt: 500,
    };
    saveSprintNote(note);

    const item = buildNewsFeed().find((entry) => entry.id === "sprint-note-note-1");
    expect(item).toMatchObject({
      category: "community",
      title: 'erin added a "Immigration" prep note',
      timestamp: 500,
      href: "/cards/collaboration",
    });
    expect(item?.body).toBe(
      'erin logged a "Immigration" prep note: Need a 2026 solvency card for the affirmative',
    );
  });

  it("includes a newly submitted, live Argument Library entry as a community item", () => {
    const entry: EvidenceLibraryEntry = {
      id: "entry-1",
      argBlock: "Warming DA",
      wordCount: 8,
      topic: "Energy Policy",
      caseArea: "DA",
      tags: ["warming"],
      kind: "card",
      text: "Rising emissions accelerate catastrophic warming impacts.",
      cite: "Smith 24",
      createdAt: 700,
    };
    saveEvidenceLibraryEntry(entry);

    const item = buildNewsFeed().find((news) => news.id === "argument-library-entry-entry-1");
    expect(item).toMatchObject({
      category: "community",
      title: 'New card added to the Argument Library: "Warming DA"',
      timestamp: 700,
      href: "/cards/argument-library",
    });
    expect(item?.body).toBe(
      'New card for "Warming DA" citing Smith 24: Rising emissions accelerate catastrophic warming impacts.',
    );
  });

  it("omits an Argument Library entry saved before createdAt existed", () => {
    const entry: EvidenceLibraryEntry = {
      id: "entry-legacy",
      argBlock: "Legacy Block",
      wordCount: 4,
      topic: "Energy Policy",
      caseArea: "Case",
      tags: [],
      kind: "block",
      text: "Pre-existing block with no createdAt.",
      cite: "",
    };
    saveEvidenceLibraryEntry(entry);

    expect(buildNewsFeed().find((news) => news.id === "argument-library-entry-entry-legacy")).toBeUndefined();
  });

  it("caps sprint notes to the most recent MAX_COMMUNITY_ITEMS_PER_SOURCE, dropping older ones", () => {
    for (let i = 0; i < 25; i++) {
      saveSprintNote({
        id: `note-${i}`,
        topic: "Immigration",
        authorId: "erin",
        text: `Note ${i}`,
        status: "open",
        createdAt: i,
        updatedAt: i,
      });
    }

    const feed = buildNewsFeed();
    const sprintNoteItems = feed.filter((item) => item.id.startsWith("sprint-note-"));
    expect(sprintNoteItems).toHaveLength(20);
    // The 20 most recent (highest createdAt) survive; the oldest 5 don't.
    expect(feed.find((item) => item.id === "sprint-note-note-24")).toBeDefined();
    expect(feed.find((item) => item.id === "sprint-note-note-4")).toBeUndefined();
  });

  it("caps Argument Library entries to the most recent MAX_COMMUNITY_ITEMS_PER_SOURCE, dropping older ones", () => {
    for (let i = 0; i < 25; i++) {
      saveEvidenceLibraryEntry({
        id: `entry-${i}`,
        argBlock: "Warming DA",
        wordCount: 4,
        topic: "Energy Policy",
        caseArea: "DA",
        tags: [],
        kind: "block",
        text: `Entry ${i}`,
        cite: "",
        createdAt: i,
      });
    }

    const feed = buildNewsFeed();
    const entryItems = feed.filter((item) => item.id.startsWith("argument-library-entry-"));
    expect(entryItems).toHaveLength(20);
    expect(feed.find((item) => item.id === "argument-library-entry-entry-24")).toBeDefined();
    expect(feed.find((item) => item.id === "argument-library-entry-entry-4")).toBeUndefined();
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

describe("account sync (listReadIds / listLikedIds / mergeRemoteViewerState)", () => {
  it("lists no read/liked ids before anything is marked", () => {
    expect(listReadIds()).toEqual([]);
    expect(listLikedIds()).toEqual([]);
  });

  it("lists every id marked read/liked, for pushing to the account", () => {
    markNewsItemRead("a");
    markNewsItemRead("b");
    toggleNewsItemLiked("a");
    expect(listReadIds().sort()).toEqual(["a", "b"]);
    expect(listLikedIds()).toEqual(["a"]);
  });

  it("merges remote ids into local state that had nothing yet", () => {
    const changed = mergeRemoteViewerState({ read: ["x", "y"], liked: ["x"] });
    expect(changed).toBe(true);
    expect(isNewsItemRead("x")).toBe(true);
    expect(isNewsItemRead("y")).toBe(true);
    expect(isNewsItemLiked("x")).toBe(true);
    expect(isNewsItemLiked("y")).toBe(false);
  });

  it("is a union, not a replacement — local-only ids survive a remote merge", () => {
    markNewsItemRead("local-only");
    mergeRemoteViewerState({ read: ["remote-only"] });
    expect(isNewsItemRead("local-only")).toBe(true);
    expect(isNewsItemRead("remote-only")).toBe(true);
  });

  it("reports no change and is a no-op when every remote id is already local", () => {
    markNewsItemRead("a");
    toggleNewsItemLiked("a");
    const changed = mergeRemoteViewerState({ read: ["a"], liked: ["a"] });
    expect(changed).toBe(false);
  });

  it("treats missing read/liked fields as empty", () => {
    expect(mergeRemoteViewerState({})).toBe(false);
    expect(listReadIds()).toEqual([]);
    expect(listLikedIds()).toEqual([]);
  });
});
