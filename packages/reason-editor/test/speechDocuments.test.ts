import { beforeEach, describe, expect, it } from "vitest";
import {
  deleteSpeechDocument,
  findSpeechDocumentByTitle,
  getSpeechDocument,
  listSpeechDocuments,
  removeSpeechDocumentBlockAndSave,
  saveSpeechDocument,
  sendSelectionToSpeechDocument,
} from "../src/state/speechDocuments";
import type { SpeechDocument } from "../src/engine/speech-document";

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

const DOC_1: SpeechDocument = {
  id: "doc-1",
  title: "1AC Solvency",
  blocks: [{ id: "block-1", text: "First point.", addedAt: 1000 }],
};

const DOC_2: SpeechDocument = {
  id: "doc-2",
  title: "1NC Case",
  blocks: [],
};

let idCounter = 0;
function nextId(): string {
  idCounter += 1;
  return `generated-${idCounter}`;
}

beforeEach(() => {
  (globalThis as unknown as { localStorage: MemoryStorage }).localStorage = new MemoryStorage();
  idCounter = 0;
});

describe("listSpeechDocuments", () => {
  it("returns an empty list when nothing is stored", () => {
    expect(listSpeechDocuments()).toEqual([]);
  });

  it("returns an empty list when the stored value is corrupt JSON", () => {
    localStorage.setItem("reasonEditorSpeechDocuments", "{not json");
    expect(listSpeechDocuments()).toEqual([]);
  });

  it("returns an empty list when the stored value isn't an array", () => {
    localStorage.setItem("reasonEditorSpeechDocuments", JSON.stringify({ not: "an array" }));
    expect(listSpeechDocuments()).toEqual([]);
  });

  it("lists every saved document", () => {
    saveSpeechDocument(DOC_1);
    saveSpeechDocument(DOC_2);
    expect(listSpeechDocuments()).toEqual([DOC_1, DOC_2]);
  });
});

describe("getSpeechDocument / findSpeechDocumentByTitle", () => {
  it("finds a saved document by id", () => {
    saveSpeechDocument(DOC_1);
    expect(getSpeechDocument("doc-1")).toEqual(DOC_1);
  });

  it("returns undefined for an id that isn't stored", () => {
    expect(getSpeechDocument("missing")).toBeUndefined();
  });

  it("finds a saved document by title, case-insensitively and trimmed", () => {
    saveSpeechDocument(DOC_1);
    expect(findSpeechDocumentByTitle("1ac solvency")).toEqual(DOC_1);
    expect(findSpeechDocumentByTitle("  1AC SOLVENCY  ")).toEqual(DOC_1);
  });

  it("returns undefined for a title that isn't stored", () => {
    expect(findSpeechDocumentByTitle("Missing")).toBeUndefined();
  });
});

describe("saveSpeechDocument", () => {
  it("upserts — saving an existing id overwrites rather than duplicating it", () => {
    saveSpeechDocument(DOC_1);
    const revised: SpeechDocument = { ...DOC_1, title: "1AC Solvency Revised" };
    saveSpeechDocument(revised);

    expect(listSpeechDocuments()).toEqual([revised]);
    expect(getSpeechDocument("doc-1")).toEqual(revised);
  });
});

describe("deleteSpeechDocument", () => {
  it("removes a stored document by id", () => {
    saveSpeechDocument(DOC_1);
    saveSpeechDocument(DOC_2);
    deleteSpeechDocument("doc-1");

    expect(listSpeechDocuments()).toEqual([DOC_2]);
    expect(getSpeechDocument("doc-1")).toBeUndefined();
  });

  it("is a no-op when the id isn't stored", () => {
    saveSpeechDocument(DOC_2);
    deleteSpeechDocument("missing");
    expect(listSpeechDocuments()).toEqual([DOC_2]);
  });
});

describe("removeSpeechDocumentBlockAndSave", () => {
  it("removes a block and persists the result", () => {
    saveSpeechDocument(DOC_1);
    const updated = removeSpeechDocumentBlockAndSave("doc-1", "block-1");

    expect(updated?.blocks).toEqual([]);
    expect(getSpeechDocument("doc-1")?.blocks).toEqual([]);
  });

  it("returns undefined when the document isn't stored", () => {
    expect(removeSpeechDocumentBlockAndSave("missing", "block-1")).toBeUndefined();
  });
});

describe("sendSelectionToSpeechDocument", () => {
  it("creates a new document when no title match exists", () => {
    const result = sendSelectionToSpeechDocument("1AC Solvency", "Warming is real.", "Smith 24", nextId, 5000);

    expect(result).toEqual({
      id: "generated-2",
      title: "1AC Solvency",
      blocks: [{ id: "generated-1", text: "Warming is real.", addedAt: 5000, sourceLabel: "Smith 24" }],
    });
    expect(listSpeechDocuments()).toEqual([result]);
  });

  it("appends to an existing document matched by title", () => {
    saveSpeechDocument(DOC_1);
    const result = sendSelectionToSpeechDocument("1ac solvency", "Second point.", undefined, nextId, 6000);

    expect(result?.id).toBe("doc-1");
    expect(result?.blocks).toEqual([
      DOC_1.blocks[0],
      { id: "generated-1", text: "Second point.", addedAt: 6000 },
    ]);
    expect(getSpeechDocument("doc-1")?.blocks).toHaveLength(2);
  });

  it("returns null and persists nothing for blank text", () => {
    const result = sendSelectionToSpeechDocument("New Doc", "   ", undefined, nextId, 7000);

    expect(result).toBeNull();
    expect(listSpeechDocuments()).toEqual([]);
  });
});
