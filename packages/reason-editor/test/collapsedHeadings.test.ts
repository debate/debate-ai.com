import { beforeEach, describe, expect, it } from "vitest";
import {
  deleteCollapsedHeadingSelection,
  getCollapsedHeadingSelection,
  listCollapsedHeadingSelections,
  saveCollapsedHeadingSelection,
} from "../src/state/collapsedHeadings";
import type { CollapsedHeadingSelection } from "../src/state/collapsedHeadings";

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

const DOC_1_TWO_COLLAPSED: CollapsedHeadingSelection = {
  documentId: "doc-1",
  collapsedIds: ["pocket-1", "hat-2"],
};

const DOC_2_NONE_COLLAPSED: CollapsedHeadingSelection = {
  documentId: "doc-2",
  collapsedIds: [],
};

beforeEach(() => {
  (globalThis as unknown as { localStorage: MemoryStorage }).localStorage = new MemoryStorage();
});

describe("listCollapsedHeadingSelections", () => {
  it("returns an empty list when nothing is stored", () => {
    expect(listCollapsedHeadingSelections()).toEqual([]);
  });

  it("returns an empty list when the stored value is corrupt JSON", () => {
    localStorage.setItem("reasonEditorCollapsedHeadings", "{not json");
    expect(listCollapsedHeadingSelections()).toEqual([]);
  });

  it("returns an empty list when the stored value isn't an array", () => {
    localStorage.setItem("reasonEditorCollapsedHeadings", JSON.stringify({ not: "an array" }));
    expect(listCollapsedHeadingSelections()).toEqual([]);
  });

  it("lists every saved selection", () => {
    saveCollapsedHeadingSelection(DOC_1_TWO_COLLAPSED);
    saveCollapsedHeadingSelection(DOC_2_NONE_COLLAPSED);
    expect(listCollapsedHeadingSelections()).toEqual([DOC_1_TWO_COLLAPSED, DOC_2_NONE_COLLAPSED]);
  });
});

describe("getCollapsedHeadingSelection", () => {
  it("finds a saved selection by documentId", () => {
    saveCollapsedHeadingSelection(DOC_1_TWO_COLLAPSED);
    expect(getCollapsedHeadingSelection("doc-1")).toEqual(DOC_1_TWO_COLLAPSED);
  });

  it("returns undefined for a documentId that isn't stored", () => {
    expect(getCollapsedHeadingSelection("missing")).toBeUndefined();
  });
});

describe("saveCollapsedHeadingSelection", () => {
  it("upserts — saving an existing documentId overwrites rather than duplicating it", () => {
    saveCollapsedHeadingSelection(DOC_1_TWO_COLLAPSED);
    const revised: CollapsedHeadingSelection = { documentId: "doc-1", collapsedIds: ["hat-2"] };
    saveCollapsedHeadingSelection(revised);

    expect(listCollapsedHeadingSelections()).toEqual([revised]);
    expect(getCollapsedHeadingSelection("doc-1")).toEqual(revised);
  });
});

describe("deleteCollapsedHeadingSelection", () => {
  it("removes a stored selection by documentId", () => {
    saveCollapsedHeadingSelection(DOC_1_TWO_COLLAPSED);
    saveCollapsedHeadingSelection(DOC_2_NONE_COLLAPSED);
    deleteCollapsedHeadingSelection("doc-1");

    expect(listCollapsedHeadingSelections()).toEqual([DOC_2_NONE_COLLAPSED]);
    expect(getCollapsedHeadingSelection("doc-1")).toBeUndefined();
  });

  it("is a no-op when the documentId isn't stored", () => {
    saveCollapsedHeadingSelection(DOC_2_NONE_COLLAPSED);
    deleteCollapsedHeadingSelection("missing");
    expect(listCollapsedHeadingSelections()).toEqual([DOC_2_NONE_COLLAPSED]);
  });
});
