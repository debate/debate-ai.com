// @vitest-environment jsdom
/**
 * @fileoverview `state/pendingWordCountDeletes.ts` — the persisted set of
 * word-count rounds awaiting an account delete: parsing a stored list,
 * sharing one list across instances (tabs), and falling back to memory when
 * storage can't be read or written.
 */

import { beforeEach, describe, expect, it } from "vitest";
import {
  MAX_PENDING_WORD_COUNT_DELETES,
  PENDING_WORD_COUNT_DELETES_KEY,
  createPendingWordCountDeletes,
  parsePendingWordCountDeletes,
  type PendingDeletesStorage,
} from "../src/state/pendingWordCountDeletes";

beforeEach(() => localStorage.clear());

describe("parsePendingWordCountDeletes", () => {
  it("reads nothing from a missing, malformed or non-array entry", () => {
    expect(parsePendingWordCountDeletes(null)).toEqual([]);
    expect(parsePendingWordCountDeletes("")).toEqual([]);
    expect(parsePendingWordCountDeletes("{not json")).toEqual([]);
    expect(parsePendingWordCountDeletes('{"a":1}')).toEqual([]);
  });

  it("keeps non-blank, unique strings within the id length cap", () => {
    const tooLong = "x".repeat(201);
    expect(parsePendingWordCountDeletes(JSON.stringify(["a", 1, "", "  ", null, "a", tooLong, "b"]))).toEqual(["a", "b"]);
  });

  it("keeps only the newest ids past the cap", () => {
    const ids = Array.from({ length: MAX_PENDING_WORD_COUNT_DELETES + 3 }, (_, i) => `r${i}`);
    const parsed = parsePendingWordCountDeletes(JSON.stringify(ids));
    expect(parsed).toHaveLength(MAX_PENDING_WORD_COUNT_DELETES);
    expect(parsed[0]).toBe("r3");
  });
});

describe("createPendingWordCountDeletes", () => {
  it("persists adds and deletes, and removes the entry once empty", () => {
    const pending = createPendingWordCountDeletes();
    pending.add("a");
    pending.add("b");
    pending.add("a");
    expect(JSON.parse(localStorage.getItem(PENDING_WORD_COUNT_DELETES_KEY) ?? "null")).toEqual(["a", "b"]);
    expect(pending.has("a")).toBe(true);

    pending.delete("a");
    expect(pending.values()).toEqual(["b"]);
    pending.clear();
    expect(localStorage.getItem(PENDING_WORD_COUNT_DELETES_KEY)).toBeNull();
    expect(pending.has("b")).toBe(false);
  });

  it("is read by a later instance, as after the tab closes and the page loads again", () => {
    createPendingWordCountDeletes().add("a");
    expect(createPendingWordCountDeletes().values()).toEqual(["a"]);
  });

  it("doesn't write back an id another tab already confirmed", () => {
    const tabA = createPendingWordCountDeletes();
    const tabB = createPendingWordCountDeletes();
    tabA.add("a");
    tabB.add("b");
    tabA.delete("a");
    tabB.add("c");
    expect(createPendingWordCountDeletes().values()).toEqual(["b", "c"]);
  });

  it("works from memory with no storage", () => {
    const pending = createPendingWordCountDeletes(() => null);
    pending.add("a");
    expect(pending.has("a")).toBe(true);
    expect(localStorage.getItem(PENDING_WORD_COUNT_DELETES_KEY)).toBeNull();
  });

  it("works from memory when storage throws on every call", () => {
    const broken: PendingDeletesStorage = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
      removeItem: () => {
        throw new Error("blocked");
      },
    };
    const pending = createPendingWordCountDeletes(() => broken);
    pending.add("a");
    pending.add("b");
    pending.delete("a");
    expect(pending.values()).toEqual(["b"]);
  });

  it("keeps an id in memory when the write fails but reads still work (storage full)", () => {
    const full: PendingDeletesStorage = {
      getItem: (key) => localStorage.getItem(key),
      setItem: () => {
        throw new DOMException("full", "QuotaExceededError");
      },
      removeItem: (key) => localStorage.removeItem(key),
    };
    const pending = createPendingWordCountDeletes(() => full);
    pending.add("a");
    expect(pending.has("a")).toBe(true);
    expect(pending.values()).toEqual(["a"]);
  });
});
