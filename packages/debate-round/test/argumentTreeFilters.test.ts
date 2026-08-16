import { beforeEach, describe, expect, it } from "vitest";
import {
  deleteArgumentTreeFilterSelection,
  getArgumentTreeFilterSelection,
  listArgumentTreeFilterSelections,
  saveArgumentTreeFilterSelection,
} from "../src/state/argumentTreeFilters";
import type { ArgumentTreeFilterSelection } from "../src/state/argumentTreeFilters";

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

const ROUND_1_UNANSWERED: ArgumentTreeFilterSelection = {
  roundId: "round-1",
  filter: { sideKey: "A", onlyUnanswered: true },
};

const ROUND_2_HEADINGS: ArgumentTreeFilterSelection = {
  roundId: "round-2",
  filter: { kind: "heading" },
};

beforeEach(() => {
  (globalThis as unknown as { localStorage: MemoryStorage }).localStorage = new MemoryStorage();
});

describe("listArgumentTreeFilterSelections", () => {
  it("returns an empty list when nothing is stored", () => {
    expect(listArgumentTreeFilterSelections()).toEqual([]);
  });

  it("returns an empty list when the stored value is corrupt JSON", () => {
    localStorage.setItem("argumentTreeFilters", "{not json");
    expect(listArgumentTreeFilterSelections()).toEqual([]);
  });

  it("returns an empty list when the stored value isn't an array", () => {
    localStorage.setItem("argumentTreeFilters", JSON.stringify({ not: "an array" }));
    expect(listArgumentTreeFilterSelections()).toEqual([]);
  });

  it("lists every saved selection", () => {
    saveArgumentTreeFilterSelection(ROUND_1_UNANSWERED);
    saveArgumentTreeFilterSelection(ROUND_2_HEADINGS);
    expect(listArgumentTreeFilterSelections()).toEqual([ROUND_1_UNANSWERED, ROUND_2_HEADINGS]);
  });
});

describe("getArgumentTreeFilterSelection", () => {
  it("finds a saved selection by roundId", () => {
    saveArgumentTreeFilterSelection(ROUND_1_UNANSWERED);
    expect(getArgumentTreeFilterSelection("round-1")).toEqual(ROUND_1_UNANSWERED);
  });

  it("returns undefined for a roundId that isn't stored", () => {
    expect(getArgumentTreeFilterSelection("missing")).toBeUndefined();
  });
});

describe("saveArgumentTreeFilterSelection", () => {
  it("upserts — saving an existing roundId overwrites rather than duplicating it", () => {
    saveArgumentTreeFilterSelection(ROUND_1_UNANSWERED);
    const revised: ArgumentTreeFilterSelection = { roundId: "round-1", filter: { speech: "1AC" } };
    saveArgumentTreeFilterSelection(revised);

    expect(listArgumentTreeFilterSelections()).toEqual([revised]);
    expect(getArgumentTreeFilterSelection("round-1")).toEqual(revised);
  });
});

describe("deleteArgumentTreeFilterSelection", () => {
  it("removes a stored selection by roundId", () => {
    saveArgumentTreeFilterSelection(ROUND_1_UNANSWERED);
    saveArgumentTreeFilterSelection(ROUND_2_HEADINGS);
    deleteArgumentTreeFilterSelection("round-1");

    expect(listArgumentTreeFilterSelections()).toEqual([ROUND_2_HEADINGS]);
    expect(getArgumentTreeFilterSelection("round-1")).toBeUndefined();
  });

  it("is a no-op when the roundId isn't stored", () => {
    saveArgumentTreeFilterSelection(ROUND_2_HEADINGS);
    deleteArgumentTreeFilterSelection("missing");
    expect(listArgumentTreeFilterSelections()).toEqual([ROUND_2_HEADINGS]);
  });
});
