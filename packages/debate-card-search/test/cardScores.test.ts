import { beforeEach, describe, expect, it } from "vitest";
import {
  bulkImportScoredCards,
  buildPersistedCardScoreRanking,
  buildRealCorpusTexts,
  deleteScoredCard,
  deriveArgBlockKeywordsForTopic,
  getScoredCard,
  getScoredCardBreakdown,
  listScoredCards,
  saveScoredCard,
  saveScoredCardsBulk,
  scoreEvidenceLibraryEntry,
} from "../src/state/cardScores";
import { saveEvidenceLibraryEntry } from "../src/state/evidenceLibraryEntries";
import { saveTrackedArgument } from "../src/state/trackedArguments";
import type { EvidenceLibraryEntry } from "../src/lib/shared-evidence-library";
import type { ScoredCard } from "../src/lib/llm-card-scoring";

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

const WARMING_CARD: ScoredCard = {
  id: "card-1",
  text: "Rising emissions accelerate catastrophic warming impacts across every major ecosystem on Earth today.",
  argBlockKeywords: ["warming", "emissions"],
  qualitySignals: [0.8],
};
const SOLVENCY_CARD: ScoredCard = {
  id: "card-2",
  text: "The plan solves through direct regulatory enforcement backed by an independent oversight board.",
  argBlockKeywords: ["solvency", "enforcement"],
  qualitySignals: [0.6],
};

beforeEach(() => {
  (globalThis as unknown as { localStorage: MemoryStorage }).localStorage = new MemoryStorage();
});

describe("listScoredCards", () => {
  it("returns an empty list when nothing is stored", () => {
    expect(listScoredCards()).toEqual([]);
  });

  it("returns an empty list when the stored value is corrupt JSON", () => {
    localStorage.setItem("cardScores", "{not json");
    expect(listScoredCards()).toEqual([]);
  });

  it("returns an empty list when the stored value isn't an array", () => {
    localStorage.setItem("cardScores", JSON.stringify({ not: "an array" }));
    expect(listScoredCards()).toEqual([]);
  });

  it("lists every saved card", () => {
    saveScoredCard(WARMING_CARD);
    saveScoredCard(SOLVENCY_CARD);
    expect(listScoredCards()).toEqual([WARMING_CARD, SOLVENCY_CARD]);
  });
});

describe("getScoredCard", () => {
  it("finds a saved card by id", () => {
    saveScoredCard(WARMING_CARD);
    expect(getScoredCard("card-1")).toEqual(WARMING_CARD);
  });

  it("returns undefined for an id that isn't stored", () => {
    expect(getScoredCard("missing")).toBeUndefined();
  });
});

describe("saveScoredCard", () => {
  it("upserts — saving an existing id overwrites rather than duplicating it", () => {
    saveScoredCard(WARMING_CARD);
    const revised: ScoredCard = { ...WARMING_CARD, qualitySignals: [1] };
    saveScoredCard(revised);

    expect(listScoredCards()).toEqual([revised]);
    expect(getScoredCard("card-1")).toEqual(revised);
  });
});

describe("deleteScoredCard", () => {
  it("removes a stored card by id", () => {
    saveScoredCard(WARMING_CARD);
    saveScoredCard(SOLVENCY_CARD);
    deleteScoredCard("card-1");

    expect(listScoredCards()).toEqual([SOLVENCY_CARD]);
    expect(getScoredCard("card-1")).toBeUndefined();
  });

  it("is a no-op when the id isn't stored", () => {
    saveScoredCard(SOLVENCY_CARD);
    deleteScoredCard("missing");
    expect(listScoredCards()).toEqual([SOLVENCY_CARD]);
  });
});

describe("saveScoredCardsBulk", () => {
  it("saves a batch of new cards in one pass", () => {
    saveScoredCardsBulk([WARMING_CARD, SOLVENCY_CARD]);
    expect(listScoredCards()).toEqual([WARMING_CARD, SOLVENCY_CARD]);
  });

  it("upserts existing cards by id, leaving unrelated cards untouched", () => {
    saveScoredCard(WARMING_CARD);
    saveScoredCard(SOLVENCY_CARD);
    const revisedWarming = { ...WARMING_CARD, qualitySignals: [1] };

    saveScoredCardsBulk([revisedWarming]);

    expect(listScoredCards()).toEqual([revisedWarming, SOLVENCY_CARD]);
  });

  it("when the batch itself repeats an id, the later entry wins", () => {
    saveScoredCardsBulk([WARMING_CARD, { ...WARMING_CARD, qualitySignals: [1] }]);
    expect(listScoredCards()).toEqual([{ ...WARMING_CARD, qualitySignals: [1] }]);
  });

  it("is a no-op for an empty batch", () => {
    saveScoredCard(WARMING_CARD);
    saveScoredCardsBulk([]);
    expect(listScoredCards()).toEqual([WARMING_CARD]);
  });
});

describe("bulkImportScoredCards", () => {
  it("parses and persists every well-formed entry", () => {
    const raw = ["id: card-1", "keywords: warming, emissions", "First card text.", "---", "id: card-2", "Second card text."].join(
      "\n",
    );

    const result = bulkImportScoredCards(raw);

    expect(result).toEqual({ importedCount: 2, skippedCount: 0 });
    expect(listScoredCards()).toEqual([
      { id: "card-1", text: "First card text.", argBlockKeywords: ["warming", "emissions"], qualitySignals: [0.5] },
      { id: "card-2", text: "Second card text.", argBlockKeywords: [], qualitySignals: [0.5] },
    ]);
  });

  it("reports skipped entries without dropping the well-formed ones", () => {
    const raw = ["id: card-1", "Good card.", "---", "keywords: no-id-here"].join("\n");

    const result = bulkImportScoredCards(raw);

    expect(result).toEqual({ importedCount: 1, skippedCount: 1 });
    expect(listScoredCards().map((card) => card.id)).toEqual(["card-1"]);
  });

  it("imports nothing and skips nothing for blank input", () => {
    expect(bulkImportScoredCards("   ")).toEqual({ importedCount: 0, skippedCount: 0 });
    expect(listScoredCards()).toEqual([]);
  });

  it("carries a card's quality line into its qualitySignals", () => {
    const result = bulkImportScoredCards("id: card-1\nquality: 0.9\nCard text.");
    expect(result.importedCount).toBe(1);
    expect(getScoredCard("card-1")?.qualitySignals).toEqual([0.9]);
  });

  it("immediately reflects in buildPersistedCardScoreRanking", () => {
    bulkImportScoredCards("id: card-1\nCard text about warming.");
    expect(buildPersistedCardScoreRanking().map((entry) => entry.cardId)).toEqual(["card-1"]);
  });
});

describe("buildPersistedCardScoreRanking", () => {
  it("returns an empty ranking when nothing is persisted", () => {
    expect(buildPersistedCardScoreRanking()).toEqual([]);
  });

  it("ranks every persisted card by overall score, reusing rankCardScores directly", () => {
    saveScoredCard(WARMING_CARD);
    saveScoredCard(SOLVENCY_CARD);

    const ranking = buildPersistedCardScoreRanking();
    expect(ranking).toHaveLength(2);
    expect(ranking.map((breakdown) => breakdown.cardId).sort()).toEqual(["card-1", "card-2"]);
  });

  it("flags a near-duplicate persisted card as a likely duplicate", () => {
    saveScoredCard(WARMING_CARD);
    saveScoredCard({ ...WARMING_CARD, id: "card-1-dup" });

    const ranking = buildPersistedCardScoreRanking();
    expect(ranking.every((breakdown) => breakdown.isLikelyDuplicate)).toBe(true);
  });

  it("does not mutate the underlying stored order", () => {
    saveScoredCard(WARMING_CARD);
    saveScoredCard(SOLVENCY_CARD);
    buildPersistedCardScoreRanking();
    expect(listScoredCards()).toEqual([WARMING_CARD, SOLVENCY_CARD]);
  });

  it("flags a card as a likely duplicate of a real, persisted Shared Evidence Library entry", () => {
    const libraryEntry: EvidenceLibraryEntry = {
      id: "lib-1",
      kind: "card",
      text: WARMING_CARD.text,
      cite: "Smith 24",
      topic: "Energy Policy",
      caseArea: "Neg",
      tags: [],
      argBlock: "Warming DA",
      wordCount: WARMING_CARD.text.split(/\s+/).length,
    };
    saveEvidenceLibraryEntry(libraryEntry);
    saveScoredCard(WARMING_CARD);

    const ranking = buildPersistedCardScoreRanking();
    expect(ranking.find((breakdown) => breakdown.cardId === "card-1")?.isLikelyDuplicate).toBe(true);
  });
});

describe("buildRealCorpusTexts", () => {
  it("returns an empty list when nothing is persisted", () => {
    expect(buildRealCorpusTexts()).toEqual([]);
  });

  it("returns every persisted Shared Evidence Library entry's text", () => {
    const entry: EvidenceLibraryEntry = {
      id: "lib-1",
      kind: "card",
      text: "The plan solves through direct regulatory enforcement.",
      cite: "Smith 24",
      topic: "Energy Policy",
      caseArea: "Neg",
      tags: [],
      argBlock: "Solvency",
      wordCount: 7,
    };
    saveEvidenceLibraryEntry(entry);
    expect(buildRealCorpusTexts()).toEqual([entry.text]);
  });
});

describe("getScoredCardBreakdown", () => {
  it("returns undefined for a card that hasn't been scored", () => {
    expect(getScoredCardBreakdown("card-1")).toBeUndefined();
  });

  it("returns the breakdown for a scored card", () => {
    saveScoredCard(WARMING_CARD);
    const breakdown = getScoredCardBreakdown("card-1");
    expect(breakdown?.cardId).toBe("card-1");
    expect(breakdown?.overallScore).toBeGreaterThan(0);
  });

  it("scores uniqueness against other persisted cards, not just the corpus", () => {
    saveScoredCard(WARMING_CARD);
    saveScoredCard({ ...WARMING_CARD, id: "card-1-dup" });

    expect(getScoredCardBreakdown("card-1")?.isLikelyDuplicate).toBe(true);
  });
});

describe("scoreEvidenceLibraryEntry", () => {
  const CARD_ENTRY: EvidenceLibraryEntry = {
    id: "lib-1",
    kind: "card",
    text: "Rising emissions accelerate catastrophic warming impacts across every major ecosystem on Earth today.",
    cite: "Smith 24",
    topic: "Energy Policy",
    caseArea: "Neg",
    tags: ["climate"],
    argBlock: "Warming DA",
    wordCount: 14,
  };

  it("scores and persists the entry under its own id", () => {
    const breakdown = scoreEvidenceLibraryEntry(CARD_ENTRY);

    expect(breakdown.cardId).toBe("lib-1");
    expect(getScoredCard("lib-1")).toEqual({
      id: "lib-1",
      text: CARD_ENTRY.text,
      argBlockKeywords: expect.arrayContaining(["Warming DA", "warming", "climate"]),
      qualitySignals: [0.5],
    });
  });

  it("derives relevance from the entry's own argument block and tags, not a hand-typed keyword list", () => {
    const breakdown = scoreEvidenceLibraryEntry(CARD_ENTRY);
    expect(breakdown.relevanceScore).toBeGreaterThan(0);
  });

  it("re-scoring the same entry refreshes rather than duplicates the persisted card", () => {
    scoreEvidenceLibraryEntry(CARD_ENTRY);
    scoreEvidenceLibraryEntry(CARD_ENTRY);

    expect(listScoredCards().filter((card) => card.id === "lib-1")).toHaveLength(1);
  });

  it("immediately shows up via getScoredCardBreakdown", () => {
    scoreEvidenceLibraryEntry(CARD_ENTRY);
    expect(getScoredCardBreakdown("lib-1")?.cardId).toBe("lib-1");
  });
});

describe("deriveArgBlockKeywordsForTopic", () => {
  it("returns an empty list for a topic with no tracked arguments", () => {
    expect(deriveArgBlockKeywordsForTopic("Energy Policy")).toEqual([]);
  });

  it("derives keywords from a topic's persisted tracked-argument checklist", () => {
    saveTrackedArgument({ id: "energy-warming", topic: "Energy Policy", argBlock: "Warming DA" });
    saveTrackedArgument({ id: "energy-solvency", topic: "Energy Policy", argBlock: "Solvency" });

    const keywords = deriveArgBlockKeywordsForTopic("Energy Policy");
    expect(keywords).toContain("Warming DA");
    expect(keywords).toContain("warming");
    expect(keywords).toContain("Solvency");
  });

  it("scopes keywords to the requested topic only", () => {
    saveTrackedArgument({ id: "energy-warming", topic: "Energy Policy", argBlock: "Warming DA" });
    saveTrackedArgument({ id: "immigration-border", topic: "Immigration", argBlock: "Border Security" });

    expect(deriveArgBlockKeywordsForTopic("Immigration")).not.toContain("Warming DA");
  });
});
