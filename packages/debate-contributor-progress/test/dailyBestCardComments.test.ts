import { beforeEach, describe, expect, it } from "vitest";
import {
  adoptDailyBestCardComment,
  deleteDailyBestCardComment,
  isValidDailyBestCardComment,
  listAllDailyBestCardComments,
  listDailyBestCardComments,
  MAX_DAILY_BEST_CARD_COMMENT_TEXT_LENGTH,
  postDailyBestCardComment,
  type DailyBestCardComment,
} from "../src/state/dailyBestCardComments";

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

function makeComment(overrides: Partial<DailyBestCardComment> = {}): DailyBestCardComment {
  return {
    id: "dbc-comment-1700000000000-ab12cd",
    dayKey: "2026-08-30",
    authorId: "alex",
    text: "Great card!",
    postedAt: 1700000000000,
    ...overrides,
  };
}

describe("postDailyBestCardComment", () => {
  it("assigns a fresh id and persists the comment", () => {
    const comment = postDailyBestCardComment({ dayKey: "2026-08-30", authorId: "alex", text: "Nice find." });
    expect(comment.id).toBeTruthy();
    expect(comment.dayKey).toBe("2026-08-30");
    expect(comment.text).toBe("Nice find.");
    expect(listAllDailyBestCardComments()).toEqual([comment]);
  });

  it("trims authorId and text", () => {
    const comment = postDailyBestCardComment({ dayKey: "2026-08-30", authorId: "  alex  ", text: "  hi  " });
    expect(comment.authorId).toBe("alex");
    expect(comment.text).toBe("hi");
  });

  it("falls back to \"Anonymous\" for a blank authorId", () => {
    const comment = postDailyBestCardComment({ dayKey: "2026-08-30", authorId: "   ", text: "hi" });
    expect(comment.authorId).toBe("Anonymous");
  });

  it("caps text at MAX_DAILY_BEST_CARD_COMMENT_TEXT_LENGTH", () => {
    const longText = "x".repeat(MAX_DAILY_BEST_CARD_COMMENT_TEXT_LENGTH + 50);
    const comment = postDailyBestCardComment({ dayKey: "2026-08-30", authorId: "alex", text: longText });
    expect(comment.text).toHaveLength(MAX_DAILY_BEST_CARD_COMMENT_TEXT_LENGTH);
  });

  it("assigns distinct ids to two comments posted back to back", () => {
    const first = postDailyBestCardComment({ dayKey: "2026-08-30", authorId: "alex", text: "one" });
    const second = postDailyBestCardComment({ dayKey: "2026-08-30", authorId: "alex", text: "two" });
    expect(first.id).not.toBe(second.id);
  });
});

describe("listAllDailyBestCardComments", () => {
  it("returns an empty list when nothing has been posted", () => {
    expect(listAllDailyBestCardComments()).toEqual([]);
  });

  it("returns comments oldest first regardless of insertion order", () => {
    adoptDailyBestCardComment(makeComment({ id: "c1", postedAt: 3000 }));
    adoptDailyBestCardComment(makeComment({ id: "c2", postedAt: 1000 }));
    adoptDailyBestCardComment(makeComment({ id: "c3", postedAt: 2000 }));
    expect(listAllDailyBestCardComments().map((c) => c.id)).toEqual(["c2", "c3", "c1"]);
  });
});

describe("listDailyBestCardComments", () => {
  it("filters to just one day's thread, oldest first", () => {
    adoptDailyBestCardComment(makeComment({ id: "c1", dayKey: "2026-08-30", postedAt: 2000 }));
    adoptDailyBestCardComment(makeComment({ id: "c2", dayKey: "2026-08-31", postedAt: 1000 }));
    adoptDailyBestCardComment(makeComment({ id: "c3", dayKey: "2026-08-30", postedAt: 1000 }));
    expect(listDailyBestCardComments("2026-08-30").map((c) => c.id)).toEqual(["c3", "c1"]);
  });

  it("returns an empty list for a day with no comments", () => {
    adoptDailyBestCardComment(makeComment({ id: "c1", dayKey: "2026-08-30" }));
    expect(listDailyBestCardComments("2026-09-01")).toEqual([]);
  });
});

describe("adoptDailyBestCardComment", () => {
  it("inserts a comment not already stored", () => {
    adoptDailyBestCardComment(makeComment({ id: "c1" }));
    expect(listAllDailyBestCardComments()).toHaveLength(1);
  });

  it("overwrites an existing comment with the same id instead of duplicating it", () => {
    adoptDailyBestCardComment(makeComment({ id: "c1", text: "first" }));
    adoptDailyBestCardComment(makeComment({ id: "c1", text: "updated" }));
    const all = listAllDailyBestCardComments();
    expect(all).toHaveLength(1);
    expect(all[0].text).toBe("updated");
  });
});

describe("deleteDailyBestCardComment", () => {
  it("removes a persisted comment by id", () => {
    adoptDailyBestCardComment(makeComment({ id: "c1" }));
    adoptDailyBestCardComment(makeComment({ id: "c2" }));
    deleteDailyBestCardComment("c1");
    expect(listAllDailyBestCardComments().map((c) => c.id)).toEqual(["c2"]);
  });

  it("is a no-op for an id that isn't stored", () => {
    adoptDailyBestCardComment(makeComment({ id: "c1" }));
    expect(() => deleteDailyBestCardComment("missing")).not.toThrow();
    expect(listAllDailyBestCardComments()).toHaveLength(1);
  });
});

describe("isValidDailyBestCardComment", () => {
  it("accepts a well-formed comment", () => {
    expect(isValidDailyBestCardComment(makeComment())).toBe(true);
  });

  it.each([null, undefined, "comment", 42, [], true])("rejects a non-object value %p", (value) => {
    expect(isValidDailyBestCardComment(value)).toBe(false);
  });

  it("rejects a comment with a non-string id", () => {
    expect(isValidDailyBestCardComment(makeComment({ id: 5 as unknown as string }))).toBe(false);
  });

  it("rejects a comment with an empty/whitespace-only id", () => {
    expect(isValidDailyBestCardComment(makeComment({ id: "   " }))).toBe(false);
  });

  it.each(["2026-8-30", "2026/08/30", "not-a-day", ""])("rejects a malformed dayKey %p", (dayKey) => {
    expect(isValidDailyBestCardComment(makeComment({ dayKey }))).toBe(false);
  });

  it("rejects a comment with an empty/whitespace-only authorId", () => {
    expect(isValidDailyBestCardComment(makeComment({ authorId: "   " }))).toBe(false);
  });

  it("rejects a comment with an empty/whitespace-only text", () => {
    expect(isValidDailyBestCardComment(makeComment({ text: "   " }))).toBe(false);
  });

  it("rejects a comment whose text exceeds the max length", () => {
    expect(
      isValidDailyBestCardComment(makeComment({ text: "x".repeat(MAX_DAILY_BEST_CARD_COMMENT_TEXT_LENGTH + 1) })),
    ).toBe(false);
  });

  it("rejects a comment whose postedAt isn't a number", () => {
    expect(isValidDailyBestCardComment(makeComment({ postedAt: "yesterday" as unknown as number }))).toBe(false);
  });
});
