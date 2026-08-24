import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildCombinedPersistedArgumentLibrary,
  buildPersistedArgumentLibrary,
  checkPersistedPageForExistingCards,
  deleteEvidenceLibraryEntry,
  getEvidenceLibraryEntry,
  isEntryLive,
  listCombinedPersistedLibraryCards,
  listCombinedPersistedTags,
  listEvidenceLibraryEntries,
  listPendingReviewEntries,
  listPersistedTags,
  renameTagAcrossCombinedPersistedStores,
  renameTagAcrossPersistedEntries,
  saveEvidenceLibraryEntry,
  saveEvidenceLibraryEntryRevision,
  searchPersistedEvidenceLibrary,
  searchPersistedEvidenceLibraryWithIndex,
} from "../src/state/evidenceLibraryEntries";
import { listRevisionHistory } from "../src/state/revisionHistory";
import { getContribution, saveContribution } from "../src/state/contributions";
import { approveReview, createCardReview, publishReview, submitForReview } from "../src/lib/peer-review";
import { savePeerReview } from "../src/state/peerReviews";
import { buildEvidenceSearchFormQuery } from "../src/lib/shared-evidence-library";
import type { EvidenceLibraryEntry } from "../src/lib/shared-evidence-library";
import * as evidenceSearchIndexModule from "../src/lib/evidence-search-index";
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

  it("excludes an entry held under an in-progress peer review", () => {
    saveEvidenceLibraryEntry(WARMING_CARD);
    saveEvidenceLibraryEntry(SOLVENCY_BLOCK);
    savePeerReview(submitForReview(createCardReview("entry-1")));

    const results = searchPersistedEvidenceLibrary({});
    expect(results.map((result) => result.entry.id)).toEqual(["entry-2"]);
  });

  it("includes an entry again once its review is published", () => {
    saveEvidenceLibraryEntry(WARMING_CARD);
    savePeerReview(publishReview(approveReview(submitForReview(createCardReview("entry-1")))));

    const results = searchPersistedEvidenceLibrary({});
    expect(results.map((result) => result.entry.id)).toEqual(["entry-1"]);
  });
});

describe("searchPersistedEvidenceLibraryWithIndex", () => {
  it("searches the persisted repository via a freshly built inverted index", () => {
    saveEvidenceLibraryEntry(WARMING_CARD);
    saveEvidenceLibraryEntry(SOLVENCY_BLOCK);

    const results = searchPersistedEvidenceLibraryWithIndex({ text: "warming" });
    expect(results).toHaveLength(1);
    expect(results[0].entry).toEqual(WARMING_CARD);
  });

  it("returns an empty list when nothing is persisted", () => {
    expect(searchPersistedEvidenceLibraryWithIndex({ kind: "card" })).toEqual([]);
  });

  it("filters by kind across the persisted repository", () => {
    saveEvidenceLibraryEntry(WARMING_CARD);
    saveEvidenceLibraryEntry(SOLVENCY_BLOCK);

    const results = searchPersistedEvidenceLibraryWithIndex({ kind: "block" });
    expect(results.map((result) => result.entry.id)).toEqual(["entry-2"]);
  });

  it("treats an empty text query the same as an omitted one, combined with a kind filter", () => {
    saveEvidenceLibraryEntry(WARMING_CARD);
    saveEvidenceLibraryEntry(SOLVENCY_BLOCK);

    const results = searchPersistedEvidenceLibraryWithIndex({ text: "", kind: "card" });
    expect(results.map((result) => result.entry.id)).toEqual(["entry-1"]);
    expect(results[0].relevanceScore).toBe(0);
  });

  it("excludes an entry held under an in-progress peer review, matching searchPersistedEvidenceLibrary's gating", () => {
    saveEvidenceLibraryEntry(WARMING_CARD);
    saveEvidenceLibraryEntry(SOLVENCY_BLOCK);
    savePeerReview(submitForReview(createCardReview("entry-1")));

    const results = searchPersistedEvidenceLibraryWithIndex({});
    expect(results.map((result) => result.entry.id)).toEqual(["entry-2"]);
  });

  it("includes an entry again once its review is published", () => {
    saveEvidenceLibraryEntry(WARMING_CARD);
    savePeerReview(publishReview(approveReview(submitForReview(createCardReview("entry-1")))));

    const results = searchPersistedEvidenceLibraryWithIndex({});
    expect(results.map((result) => result.entry.id)).toEqual(["entry-1"]);
  });
});

describe("searchPersistedEvidenceLibraryWithIndex caches the index across calls", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  // `evidenceLibraryEntries.ts`'s cache is module-level state shared across
  // every test in this file (only `localStorage` is reset per test, in
  // `beforeEach` above), and several other describe blocks save this exact
  // same `WARMING_CARD`/`SOLVENCY_BLOCK` content — so whether the *first*
  // search in a given test triggers a rebuild depends on what an earlier
  // test happened to leave cached. These assertions compare the spy's call
  // count before/after an action instead of asserting an absolute count, so
  // they hold regardless of that leftover state.

  it("does not rebuild the index on a second call when nothing has changed", () => {
    saveEvidenceLibraryEntry(WARMING_CARD);
    saveEvidenceLibraryEntry(SOLVENCY_BLOCK);
    const buildSpy = vi.spyOn(evidenceSearchIndexModule, "buildEvidenceSearchIndex");

    const first = searchPersistedEvidenceLibraryWithIndex({ text: "warming" });
    const countAfterFirst = buildSpy.mock.calls.length;

    const second = searchPersistedEvidenceLibraryWithIndex({ text: "warming" });
    expect(buildSpy.mock.calls.length).toBe(countAfterFirst);
    expect(second).toEqual(first);
  });

  it("incrementally adds a newly saved entry instead of rebuilding the whole index, and the new entry is searchable", () => {
    saveEvidenceLibraryEntry(WARMING_CARD);
    // Force (and consume) the first build so this entry's later add is incremental, not part of an initial build.
    searchPersistedEvidenceLibraryWithIndex({});
    const buildSpy = vi.spyOn(evidenceSearchIndexModule, "buildEvidenceSearchIndex");
    const addSpy = vi.spyOn(evidenceSearchIndexModule, "addEntryToIndex");

    saveEvidenceLibraryEntry(SOLVENCY_BLOCK);
    const results = searchPersistedEvidenceLibraryWithIndex({});
    expect(buildSpy).not.toHaveBeenCalled();
    expect(addSpy).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ id: "entry-2" }));
    expect(results.map((result) => result.entry.id).sort()).toEqual(["entry-1", "entry-2"]);
  });

  it("incrementally removes a deleted entry instead of rebuilding the whole index", () => {
    saveEvidenceLibraryEntry(WARMING_CARD);
    saveEvidenceLibraryEntry(SOLVENCY_BLOCK);
    searchPersistedEvidenceLibraryWithIndex({});
    const buildSpy = vi.spyOn(evidenceSearchIndexModule, "buildEvidenceSearchIndex");
    const removeSpy = vi.spyOn(evidenceSearchIndexModule, "removeEntryFromIndex");

    deleteEvidenceLibraryEntry(WARMING_CARD.id);
    const results = searchPersistedEvidenceLibraryWithIndex({});
    expect(buildSpy).not.toHaveBeenCalled();
    expect(removeSpy).toHaveBeenCalledWith(expect.anything(), WARMING_CARD.id);
    expect(results.map((result) => result.entry.id)).toEqual(["entry-2"]);
  });

  it("incrementally updates an entry whose peer review transition changes its live status, with no write to the entry itself", () => {
    saveEvidenceLibraryEntry(WARMING_CARD);
    const review = submitForReview(createCardReview("entry-1"));
    savePeerReview(review);
    searchPersistedEvidenceLibraryWithIndex({});
    const buildSpy = vi.spyOn(evidenceSearchIndexModule, "buildEvidenceSearchIndex");
    const addSpy = vi.spyOn(evidenceSearchIndexModule, "addEntryToIndex");

    savePeerReview(publishReview(approveReview(review)));
    const results = searchPersistedEvidenceLibraryWithIndex({});
    expect(buildSpy).not.toHaveBeenCalled();
    expect(addSpy).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ id: "entry-1" }));
    expect(results.map((result) => result.entry.id)).toEqual(["entry-1"]);
  });

  it("incrementally updates an entry that was edited in place, leaving an untouched entry's postings alone", () => {
    saveEvidenceLibraryEntry(WARMING_CARD);
    saveEvidenceLibraryEntry(SOLVENCY_BLOCK);
    searchPersistedEvidenceLibraryWithIndex({});
    const buildSpy = vi.spyOn(evidenceSearchIndexModule, "buildEvidenceSearchIndex");
    const updateSpy = vi.spyOn(evidenceSearchIndexModule, "updateEntryInIndex");

    saveEvidenceLibraryEntry({ ...WARMING_CARD, text: "Coastal flooding accelerates under warming trends." });
    const results = searchPersistedEvidenceLibraryWithIndex({ text: "flooding" });
    expect(buildSpy).not.toHaveBeenCalled();
    expect(updateSpy).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ id: "entry-1" }));
    expect(results.map((result) => result.entry.id)).toEqual(["entry-1"]);
  });
});

describe("EvidenceLibraryPanel's search wiring (buildEvidenceSearchFormQuery -> searchPersistedEvidenceLibraryWithIndex)", () => {
  it("finds the matching entry from the panel's raw filter-field shape", () => {
    saveEvidenceLibraryEntry(WARMING_CARD);
    saveEvidenceLibraryEntry(SOLVENCY_BLOCK);

    const query = buildEvidenceSearchFormQuery({
      text: "warming",
      kind: undefined,
      topic: "Energy Policy",
      caseArea: "",
      tags: "impact",
    });
    const results = searchPersistedEvidenceLibraryWithIndex(query);
    expect(results.map((result) => result.entry.id)).toEqual(["entry-1"]);
  });

  it("returns no results when a filter field narrows past every entry", () => {
    saveEvidenceLibraryEntry(WARMING_CARD);
    saveEvidenceLibraryEntry(SOLVENCY_BLOCK);

    const query = buildEvidenceSearchFormQuery({
      text: "warming",
      kind: undefined,
      topic: "Energy Policy",
      caseArea: "Case",
      tags: "",
    });
    expect(searchPersistedEvidenceLibraryWithIndex(query)).toEqual([]);
  });

  it("excludes an entry held under an in-progress peer review through the panel's own query shape", () => {
    saveEvidenceLibraryEntry(WARMING_CARD);
    saveEvidenceLibraryEntry(SOLVENCY_BLOCK);
    savePeerReview(submitForReview(createCardReview("entry-1")));

    const query = buildEvidenceSearchFormQuery({ text: "", kind: undefined, topic: "", caseArea: "", tags: "" });
    const results = searchPersistedEvidenceLibraryWithIndex(query);
    expect(results.map((result) => result.entry.id)).toEqual(["entry-2"]);
  });
});

describe("checkPersistedPageForExistingCards", () => {
  it("reports alreadyCut true when a persisted entry's sourceUrl matches", () => {
    saveEvidenceLibraryEntry({ ...WARMING_CARD, sourceUrl: "https://news.example.com/warming-report" });

    const result = checkPersistedPageForExistingCards("http://www.news.example.com/warming-report/");
    expect(result.alreadyCut).toBe(true);
    expect(result.matches.map((entry) => entry.id)).toEqual(["entry-1"]);
  });

  it("reports alreadyCut false when nothing is persisted", () => {
    const result = checkPersistedPageForExistingCards("https://example.com/unrelated");
    expect(result.alreadyCut).toBe(false);
    expect(result.matches).toEqual([]);
  });

  it("excludes an entry held under an in-progress peer review, matching searchPersistedEvidenceLibrary's gating", () => {
    saveEvidenceLibraryEntry({ ...WARMING_CARD, sourceUrl: "https://news.example.com/warming-report" });
    savePeerReview(submitForReview(createCardReview("entry-1")));

    const result = checkPersistedPageForExistingCards("https://news.example.com/warming-report");
    expect(result.alreadyCut).toBe(false);
  });
});

describe("isEntryLive", () => {
  it("is true for an entry with no review at all", () => {
    saveEvidenceLibraryEntry(WARMING_CARD);
    expect(isEntryLive("entry-1")).toBe(true);
  });

  it("is false for an entry with an in-progress review", () => {
    saveEvidenceLibraryEntry(WARMING_CARD);
    savePeerReview(createCardReview("entry-1"));
    expect(isEntryLive("entry-1")).toBe(false);
  });

  it("is true for an entry whose review is published", () => {
    saveEvidenceLibraryEntry(WARMING_CARD);
    savePeerReview(publishReview(approveReview(submitForReview(createCardReview("entry-1")))));
    expect(isEntryLive("entry-1")).toBe(true);
  });
});

describe("listPendingReviewEntries", () => {
  it("returns an empty list when nothing is stored", () => {
    expect(listPendingReviewEntries()).toEqual([]);
  });

  it("returns only entries held under an in-progress review", () => {
    saveEvidenceLibraryEntry(WARMING_CARD);
    saveEvidenceLibraryEntry(SOLVENCY_BLOCK);
    savePeerReview(submitForReview(createCardReview("entry-1")));

    expect(listPendingReviewEntries()).toEqual([WARMING_CARD]);
  });

  it("excludes an entry once its review is published", () => {
    saveEvidenceLibraryEntry(WARMING_CARD);
    savePeerReview(publishReview(approveReview(submitForReview(createCardReview("entry-1")))));

    expect(listPendingReviewEntries()).toEqual([]);
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

describe("renameTagAcrossPersistedEntries", () => {
  it("rewrites the tag on every persisted entry that carries it and persists the result", () => {
    saveEvidenceLibraryEntry(WARMING_CARD);
    saveEvidenceLibraryEntry(SOLVENCY_BLOCK);

    const changedCount = renameTagAcrossPersistedEntries("warming", "climate-crisis");

    expect(changedCount).toBe(1);
    expect(getEvidenceLibraryEntry("entry-1")!.tags).toEqual(["impact", "climate-crisis"]);
    // The entry that never carried the tag is untouched.
    expect(getEvidenceLibraryEntry("entry-2")!.tags).toEqual(["solvency"]);
  });

  it("merges into an already-used tag name instead of duplicating it", () => {
    saveEvidenceLibraryEntry(WARMING_CARD);
    saveEvidenceLibraryEntry({ ...SOLVENCY_BLOCK, tags: ["solvency", "impact"] });

    renameTagAcrossPersistedEntries("warming", "impact");

    expect(getEvidenceLibraryEntry("entry-1")!.tags).toEqual(["impact"]);
    expect(getEvidenceLibraryEntry("entry-2")!.tags).toEqual(["solvency", "impact"]);
  });

  it("is a safe no-op, and does not write to storage, when no entry carries the tag", () => {
    saveEvidenceLibraryEntry(WARMING_CARD);
    const before = localStorage.getItem("evidenceLibraryEntries");

    const changedCount = renameTagAcrossPersistedEntries("nonexistent", "whatever");

    expect(changedCount).toBe(0);
    expect(localStorage.getItem("evidenceLibraryEntries")).toBe(before);
  });

  it("throws when newTag is blank", () => {
    saveEvidenceLibraryEntry(WARMING_CARD);
    expect(() => renameTagAcrossPersistedEntries("warming", "  ")).toThrow();
  });
});

describe("buildCombinedPersistedArgumentLibrary", () => {
  const TAGGED_CONTRIBUTION: AttributedContribution = {
    id: "contrib-1",
    contributorId: "carol",
    kind: "card",
    likes: 0,
    saves: 0,
    qualitySignals: [0.5],
    reviewerEndorsements: [],
    topic: "Energy Policy",
    caseArea: "Case",
    tags: ["solvency"],
    argBlock: "Solvency",
  };

  it("returns an empty library when nothing is stored in either store", () => {
    expect(buildCombinedPersistedArgumentLibrary()).toEqual({ topicFolders: [], tagCollections: [] });
  });

  it("includes persisted evidence-library entries", () => {
    saveEvidenceLibraryEntry(WARMING_CARD);
    const library = buildCombinedPersistedArgumentLibrary();
    expect(library.topicFolders[0].cardCount).toBe(1);
  });

  it("folds in a tagged Contributions Feed submission alongside evidence-library entries", () => {
    saveEvidenceLibraryEntry(WARMING_CARD);
    saveContribution(TAGGED_CONTRIBUTION);

    const library = buildCombinedPersistedArgumentLibrary();
    expect(library.topicFolders).toHaveLength(1);
    expect(library.topicFolders[0].cardCount).toBe(2);
    expect(library.topicFolders[0].caseAreas.map((group) => group.caseArea)).toEqual(["Case", "DA"]);
    expect(library.tagCollections.map((collection) => collection.tag)).toEqual(["impact", "solvency", "warming"]);
  });

  it("excludes a contribution missing topic or caseArea", () => {
    saveContribution({ ...TAGGED_CONTRIBUTION, id: "contrib-2", topic: undefined });
    expect(buildCombinedPersistedArgumentLibrary()).toEqual({ topicFolders: [], tagCollections: [] });
  });
});

describe("listCombinedPersistedLibraryCards", () => {
  const TAGGED_CONTRIBUTION: AttributedContribution = {
    id: "contrib-1",
    contributorId: "carol",
    kind: "card",
    likes: 0,
    saves: 0,
    qualitySignals: [0.5],
    reviewerEndorsements: [],
    topic: "Energy Policy",
    caseArea: "Case",
    tags: ["solvency"],
    argBlock: "Solvency",
  };

  it("returns an empty list when nothing is stored in either store", () => {
    expect(listCombinedPersistedLibraryCards()).toEqual([]);
  });

  it("flattens persisted evidence-library entries and tagged contributions into one list", () => {
    saveEvidenceLibraryEntry(WARMING_CARD);
    saveContribution(TAGGED_CONTRIBUTION);

    const cards = listCombinedPersistedLibraryCards();
    expect(cards).toHaveLength(2);
    expect(cards.map((card) => card.id)).toEqual(["entry-1", "contrib-1"]);
  });

  it("excludes a contribution missing topic or caseArea", () => {
    saveContribution({ ...TAGGED_CONTRIBUTION, id: "contrib-2", topic: undefined });
    expect(listCombinedPersistedLibraryCards()).toEqual([]);
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

const SOLVENCY_CONTRIBUTION: AttributedContribution = {
  id: "contrib-1",
  contributorId: "carol",
  kind: "card",
  likes: 0,
  saves: 0,
  qualitySignals: [0.5],
  reviewerEndorsements: [],
  topic: "Energy Policy",
  caseArea: "Case",
  tags: ["solvency", "warming"],
  argBlock: "Solvency",
};

describe("listCombinedPersistedTags", () => {
  it("returns an empty list when neither store holds a tag", () => {
    expect(listCombinedPersistedTags()).toEqual([]);
  });

  it("unions both stores' tags, deduped and sorted", () => {
    saveEvidenceLibraryEntry(WARMING_CARD);
    saveContribution(SOLVENCY_CONTRIBUTION);

    // "warming" is in both stores; it appears once.
    expect(listPersistedTags()).toEqual(["impact", "warming"]);
    expect(listCombinedPersistedTags()).toEqual(["impact", "solvency", "warming"]);
  });

  it("includes a contribution's tags even when it is missing topic/caseArea (so excluded from the library)", () => {
    saveContribution({ ...SOLVENCY_CONTRIBUTION, topic: undefined });
    expect(listCombinedPersistedTags()).toEqual(["solvency", "warming"]);
  });
});

describe("renameTagAcrossCombinedPersistedStores", () => {
  it("rewrites the tag in both stores and reports each store's changed count", () => {
    saveEvidenceLibraryEntry(WARMING_CARD);
    saveEvidenceLibraryEntry(SOLVENCY_BLOCK);
    saveContribution(SOLVENCY_CONTRIBUTION);

    const result = renameTagAcrossCombinedPersistedStores("warming", "climate-crisis");

    expect(result).toEqual({ entriesChanged: 1, contributionsChanged: 1, totalChanged: 2 });
    expect(getEvidenceLibraryEntry("entry-1")!.tags).toEqual(["impact", "climate-crisis"]);
    expect(getEvidenceLibraryEntry("entry-2")!.tags).toEqual(["solvency"]);
    expect(getContribution("contrib-1")!.tags).toEqual(["solvency", "climate-crisis"]);
  });

  it("rewrites one store even when the other carries nothing under the tag", () => {
    saveEvidenceLibraryEntry(SOLVENCY_BLOCK);
    saveContribution(SOLVENCY_CONTRIBUTION);

    const result = renameTagAcrossCombinedPersistedStores("warming", "climate-crisis");

    expect(result).toEqual({ entriesChanged: 0, contributionsChanged: 1, totalChanged: 1 });
  });

  it("is a safe no-op when neither store carries the tag", () => {
    saveEvidenceLibraryEntry(SOLVENCY_BLOCK);

    const result = renameTagAcrossCombinedPersistedStores("nonexistent", "whatever");

    expect(result).toEqual({ entriesChanged: 0, contributionsChanged: 0, totalChanged: 0 });
  });

  it("throws, leaving both stores untouched, when the two tags are the same", () => {
    saveEvidenceLibraryEntry(WARMING_CARD);
    saveContribution(SOLVENCY_CONTRIBUTION);

    expect(() => renameTagAcrossCombinedPersistedStores("warming", "warming")).toThrow();
    expect(getEvidenceLibraryEntry("entry-1")!.tags).toEqual(["warming", "impact"]);
    expect(getContribution("contrib-1")!.tags).toEqual(["solvency", "warming"]);
  });
});
