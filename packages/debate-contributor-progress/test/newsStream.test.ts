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
import { cleanArgBlockLabel, type NewsItem } from "../src/lib/news-stream";
import { saveEvidenceLibraryEntry } from "@debate-ai/research-evidence/src/state/evidenceLibraryEntries";
import type { EvidenceLibraryEntry } from "@debate-ai/research-evidence/src/lib/shared-evidence-library";

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

const DAY = 24 * 60 * 60 * 1000;
const BASE = Date.parse("2026-10-20T00:00:00Z");

const SAMPLE: NewsItem[] = [
  { id: "round-a", category: "rounds", title: "New round: A vs B", body: "", timestamp: 2000 },
  { id: "file-1", category: "files", title: "New file: x.docx", body: "", timestamp: 1000 },
];

function libraryEntry(overrides: Partial<EvidenceLibraryEntry> & { id: string }): EvidenceLibraryEntry {
  return {
    argBlock: "Warming DA",
    wordCount: 4,
    topic: "Energy Policy",
    caseArea: "DA",
    tags: [],
    kind: "card",
    text: "Rising emissions accelerate catastrophic warming impacts.",
    cite: "Smith 24",
    ...overrides,
  };
}

describe("cleanArgBlockLabel", () => {
  it("strips Verbatim markers, dash separators and a repeated heading", () => {
    expect(
      cleanArgBlockLabel("1AC---Single-Payer---AW > Crisis Management---1AC > <<<PARAGRAPH BREAKS END>>>"),
    ).toBe("1AC Single-Payer AW › Crisis Management");
  });

  it("leaves a plain block name alone", () => {
    expect(cleanArgBlockLabel("Warming DA")).toBe("Warming DA");
  });

  it("falls back when only markers are left", () => {
    expect(cleanArgBlockLabel("<<<PARAGRAPH BREAKS END>>>")).toBe("Untitled block");
  });
});

describe("buildNewsFeed", () => {
  it("is empty when nothing is persisted and nothing is passed in", () => {
    expect(buildNewsFeed()).toEqual([]);
  });

  it("posts no product updates or tool spotlights, only what it is given", () => {
    expect(buildNewsFeed(SAMPLE).map((item) => item.id)).toEqual(["round-a", "file-1"]);
  });

  it("posts a single new Argument Library card as one files item with a cleaned label", () => {
    saveEvidenceLibraryEntry(
      libraryEntry({
        id: "entry-1",
        argBlock: "1AC---Single-Payer---AW > Crisis Management---1AC > <<<PARAGRAPH BREAKS END>>>",
        createdAt: BASE + 700,
      }),
    );

    expect(buildNewsFeed()).toEqual([
      {
        id: "argument-library-day-2026-10-20",
        category: "files",
        title: "New in the Argument Library: 1AC Single-Payer AW › Crisis Management",
        body: "Rising emissions accelerate catastrophic warming impacts.",
        timestamp: BASE + 700,
        href: "/research/cards/argument-library",
      },
    ]);
  });

  it("groups a day's cards into one digest listing a few labels", () => {
    for (let i = 0; i < 25; i++) {
      saveEvidenceLibraryEntry(libraryEntry({ id: `entry-${i}`, argBlock: `Block ${i}`, createdAt: BASE + i }));
    }

    const feed = buildNewsFeed();
    expect(feed).toHaveLength(1);
    expect(feed[0].title).toBe("25 new cards and blocks in the Argument Library");
    expect(feed[0].body).toBe("Block 24\nBlock 23\nBlock 22\nand 22 more");
    expect(feed[0].timestamp).toBe(BASE + 24);
  });

  it("keeps only the three most recent days of digests", () => {
    for (let d = 0; d < 5; d++) {
      saveEvidenceLibraryEntry(libraryEntry({ id: `entry-${d}`, createdAt: BASE - d * DAY }));
    }

    expect(buildNewsFeed().map((item) => item.id)).toEqual([
      "argument-library-day-2026-10-20",
      "argument-library-day-2026-10-19",
      "argument-library-day-2026-10-18",
    ]);
  });

  it("omits an Argument Library entry saved before createdAt existed", () => {
    saveEvidenceLibraryEntry(libraryEntry({ id: "entry-legacy" }));
    expect(buildNewsFeed()).toEqual([]);
  });

  it("sorts extra items and digests newest first together", () => {
    saveEvidenceLibraryEntry(libraryEntry({ id: "entry-1", createdAt: 1500 }));
    expect(buildNewsFeed(SAMPLE).map((item) => item.id)).toEqual([
      "round-a",
      "argument-library-day-1970-01-01",
      "file-1",
    ]);
  });
});

describe("read/like viewer state", () => {
  it("starts with every item unread and unliked", () => {
    const [first] = SAMPLE;
    expect(isNewsItemRead(first.id)).toBe(false);
    expect(isNewsItemLiked(first.id)).toBe(false);
  });

  it("marks an item read idempotently", () => {
    const [first] = SAMPLE;
    markNewsItemRead(first.id);
    markNewsItemRead(first.id);
    expect(isNewsItemRead(first.id)).toBe(true);
  });

  it("toggles like state and returns the new state", () => {
    const [first] = SAMPLE;
    expect(toggleNewsItemLiked(first.id)).toBe(true);
    expect(isNewsItemLiked(first.id)).toBe(true);
    expect(toggleNewsItemLiked(first.id)).toBe(false);
    expect(isNewsItemLiked(first.id)).toBe(false);
  });

  it("counts only items not yet marked read", () => {
    const items = SAMPLE.slice(0, 2);
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

  it("clears a like once another device's unlike has landed on the account", () => {
    // First hydrate: the account confirms "x" liked — records it as synced.
    mergeRemoteViewerState({ read: [], liked: ["x"] });
    expect(isNewsItemLiked("x")).toBe(true);

    // A second device unlikes "x"; this browser's next hydrate sees it gone.
    const changed = mergeRemoteViewerState({ read: [], liked: [] });
    expect(changed).toBe(true);
    expect(isNewsItemLiked("x")).toBe(false);
  });

  it("does not clear a local like that was never confirmed synced", () => {
    // Liked locally but the push never landed (offline/failed) — the
    // account row still reports no likes at all.
    toggleNewsItemLiked("y");
    const changed = mergeRemoteViewerState({ read: [], liked: [] });
    expect(changed).toBe(false);
    expect(isNewsItemLiked("y")).toBe(true);
  });

  it("keeps a like confirmed synced on a later hydrate that still reports it", () => {
    mergeRemoteViewerState({ read: [], liked: ["x"] });
    const changed = mergeRemoteViewerState({ read: [], liked: ["x"] });
    expect(changed).toBe(false);
    expect(isNewsItemLiked("x")).toBe(true);
  });

  it("reconciles one unliked id while still unioning in a newly liked one", () => {
    mergeRemoteViewerState({ read: [], liked: ["x"] });
    // Another device unliked "x" and liked "z"; both land in this fetch.
    const changed = mergeRemoteViewerState({ read: [], liked: ["z"] });
    expect(changed).toBe(true);
    expect(isNewsItemLiked("x")).toBe(false);
    expect(isNewsItemLiked("z")).toBe(true);
  });

  it("leaves liked state alone when the liked field is entirely absent", () => {
    mergeRemoteViewerState({ read: [], liked: ["x"] });
    const changed = mergeRemoteViewerState({ read: ["r"] });
    expect(changed).toBe(true); // from the new "r" read id
    expect(isNewsItemLiked("x")).toBe(true);
  });
});
