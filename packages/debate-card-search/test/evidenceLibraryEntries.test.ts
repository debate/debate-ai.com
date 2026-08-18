import { beforeEach, describe, expect, it } from "vitest";
import {
  buildPersistedArgumentLibrary,
  deleteEvidenceLibraryEntry,
  getEvidenceLibraryEntry,
  listEvidenceLibraryEntries,
  saveEvidenceLibraryEntry,
  saveEvidenceLibraryEntryRevision,
  searchPersistedEvidenceLibrary,
} from "../src/state/evidenceLibraryEntries";
import { listRevisionHistory } from "../src/state/revisionHistory";
import type { EvidenceLibraryEntry } from "../src/lib/shared-evidence-library";

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

const WARMING_CARD: EvidenceLibraryEntry = {
  id: "entry-1",
  argBlock: "Warming DA",
  wordCount: 120,
  topic: "Energy Policy",
  caseArea: "DA",
  tags: ["warming", "impact"],
  kind: "card",
  text: "Rising emissions accelerate catastrophic warming impacts.",
  cite: "Smith 24",
};
const SOLVENCY_BLOCK: EvidenceLibraryEntry = {
  id: "entry-2",
  argBlock: "Solvency",
  wordCount: 80,
  topic: "Energy Policy",
  caseArea: "Case",
  tags: ["solvency"],
  kind: "block",
  text: "The plan solves through direct regulatory enforcement.",
  cite: "",
};

beforeEach(() => {
  (globalThis as unknown as { localStorage: MemoryStorage }).localStorage = new MemoryStorage();
});

describe("listEvidenceLibraryEntries", () => {
  it("returns an empty list when nothing is stored", () => {
    expect(listEvidenceLibraryEntries()).toEqual([]);
  });

  it("returns an empty list when the stored value is corrupt JSON", () => {
    localStorage.setItem("evidenceLibraryEntries", "{not json");
    expect(listEvidenceLibraryEntries()).toEqual([]);
  });

  it("returns an empty list when the stored value isn't an array", () => {
    localStorage.setItem("evidenceLibraryEntries", JSON.stringify({ not: "an array" }));
    expect(listEvidenceLibraryEntries()).toEqual([]);
  });

  it("lists every saved entry", () => {
    saveEvidenceLibraryEntry(WARMING_CARD);
    saveEvidenceLibraryEntry(SOLVENCY_BLOCK);
    expect(listEvidenceLibraryEntries()).toEqual([WARMING_CARD, SOLVENCY_BLOCK]);
  });
});

describe("getEvidenceLibraryEntry", () => {
  it("finds a saved entry by id", () => {
    saveEvidenceLibraryEntry(WARMING_CARD);
    expect(getEvidenceLibraryEntry("entry-1")).toEqual(WARMING_CARD);
  });

  it("returns undefined for an id that isn't stored", () => {
    expect(getEvidenceLibraryEntry("missing")).toBeUndefined();
  });
});

describe("saveEvidenceLibraryEntry", () => {
  it("upserts — saving an existing id overwrites rather than duplicating it", () => {
    saveEvidenceLibraryEntry(WARMING_CARD);
    const revised: EvidenceLibraryEntry = { ...WARMING_CARD, wordCount: 200 };
    saveEvidenceLibraryEntry(revised);

    expect(listEvidenceLibraryEntries()).toEqual([revised]);
    expect(getEvidenceLibraryEntry("entry-1")).toEqual(revised);
  });
});

describe("deleteEvidenceLibraryEntry", () => {
  it("removes a stored entry by id", () => {
    saveEvidenceLibraryEntry(WARMING_CARD);
    saveEvidenceLibraryEntry(SOLVENCY_BLOCK);
    deleteEvidenceLibraryEntry("entry-1");

    expect(listEvidenceLibraryEntries()).toEqual([SOLVENCY_BLOCK]);
    expect(getEvidenceLibraryEntry("entry-1")).toBeUndefined();
  });

  it("is a no-op when the id isn't stored", () => {
    saveEvidenceLibraryEntry(SOLVENCY_BLOCK);
    deleteEvidenceLibraryEntry("missing");
    expect(listEvidenceLibraryEntries()).toEqual([SOLVENCY_BLOCK]);
  });
});

describe("searchPersistedEvidenceLibrary", () => {
  it("searches the persisted repository, reusing searchEvidenceLibrary directly", () => {
    saveEvidenceLibraryEntry(WARMING_CARD);
    saveEvidenceLibraryEntry(SOLVENCY_BLOCK);

    const results = searchPersistedEvidenceLibrary({ text: "warming" });
    expect(results).toHaveLength(1);
    expect(results[0].entry).toEqual(WARMING_CARD);
  });

  it("returns an empty list when nothing is persisted", () => {
    expect(searchPersistedEvidenceLibrary({ kind: "card" })).toEqual([]);
  });

  it("filters by kind across the persisted repository", () => {
    saveEvidenceLibraryEntry(WARMING_CARD);
    saveEvidenceLibraryEntry(SOLVENCY_BLOCK);

    const results = searchPersistedEvidenceLibrary({ kind: "block" });
    expect(results.map((result) => result.entry.id)).toEqual(["entry-2"]);
  });

  it("treats an empty text query the same as an omitted one, combined with a kind filter", () => {
    saveEvidenceLibraryEntry(WARMING_CARD);
    saveEvidenceLibraryEntry(SOLVENCY_BLOCK);

    const results = searchPersistedEvidenceLibrary({ text: "", kind: "card" });
    expect(results.map((result) => result.entry.id)).toEqual(["entry-1"]);
    expect(results[0].relevanceScore).toBe(0);
  });
});

describe("buildPersistedArgumentLibrary", () => {
  it("returns an empty library when nothing is stored", () => {
    expect(buildPersistedArgumentLibrary()).toEqual({ topicFolders: [], tagCollections: [] });
  });

  it("organizes persisted entries into topic folders split by case area", () => {
    saveEvidenceLibraryEntry(WARMING_CARD);
    saveEvidenceLibraryEntry(SOLVENCY_BLOCK);

    const library = buildPersistedArgumentLibrary();
    expect(library.topicFolders).toHaveLength(1);
    expect(library.topicFolders[0].topic).toBe("Energy Policy");
    expect(library.topicFolders[0].cardCount).toBe(2);
    expect(library.topicFolders[0].caseAreas.map((group) => group.caseArea)).toEqual(["Case", "DA"]);
  });

  it("organizes persisted entries into tag collections", () => {
    saveEvidenceLibraryEntry(WARMING_CARD);
    saveEvidenceLibraryEntry(SOLVENCY_BLOCK);

    const library = buildPersistedArgumentLibrary();
    expect(library.tagCollections.map((collection) => collection.tag)).toEqual(["impact", "solvency", "warming"]);
    expect(library.tagCollections.find((collection) => collection.tag === "warming")?.cards).toEqual([
      WARMING_CARD,
    ]);
  });

  it("does not mutate the underlying stored order", () => {
    saveEvidenceLibraryEntry(WARMING_CARD);
    saveEvidenceLibraryEntry(SOLVENCY_BLOCK);
    buildPersistedArgumentLibrary();
    expect(listEvidenceLibraryEntries()).toEqual([WARMING_CARD, SOLVENCY_BLOCK]);
  });
});

describe("saveEvidenceLibraryEntryRevision", () => {
  it("saves a brand-new entry without recording a revision", () => {
    saveEvidenceLibraryEntryRevision(WARMING_CARD, "alice");

    expect(getEvidenceLibraryEntry("entry-1")).toEqual(WARMING_CARD);
    expect(listRevisionHistory()).toEqual([]);
  });

  it("overwrites an existing entry and records a revision crediting the given contributor", () => {
    saveEvidenceLibraryEntry(WARMING_CARD);

    const edited: EvidenceLibraryEntry = {
      ...WARMING_CARD,
      cite: "Smith 2024",
      text: `${WARMING_CARD.text} Newer data confirms the same trend continues to accelerate.`,
    };
    saveEvidenceLibraryEntryRevision(edited, "alice");

    expect(getEvidenceLibraryEntry("entry-1")).toEqual(edited);

    const history = listRevisionHistory();
    expect(history).toHaveLength(1);
    expect(history[0].cardId).toBe("entry-1");
    expect(history[0].contributorId).toBe("alice");
    expect(history[0].before.citationCompleteness).toBeLessThan(history[0].after.citationCompleteness);
  });

  it("records a separate revision for each subsequent edit", () => {
    saveEvidenceLibraryEntry(WARMING_CARD);
    saveEvidenceLibraryEntryRevision({ ...WARMING_CARD, cite: "Smith 2024" }, "alice");
    saveEvidenceLibraryEntryRevision({ ...WARMING_CARD, cite: "Smith 2024", caseArea: "Case" }, "bob");

    const history = listRevisionHistory();
    expect(history).toHaveLength(2);
    expect(history.map((record) => record.contributorId)).toEqual(["alice", "bob"]);
  });
});
