import { describe, expect, it } from "vitest";
import {
  buildFlowNoteFromCard,
  deriveLibraryCardKeywords,
  suggestFlowNotesFromLibrary,
} from "../src/flow/flow-note-suggestions";
import type { LibraryCard } from "debate-research-evidence/src/lib/argument-library";

const WARMING_CARD: LibraryCard = {
  id: "card-1",
  argBlock: "Warming DA",
  wordCount: 120,
  topic: "Energy Policy",
  caseArea: "DA",
  tags: ["warming", "impact"],
};

const SOLVENCY_CARD: LibraryCard = {
  id: "card-2",
  argBlock: "Solvency",
  wordCount: 80,
  topic: "Energy Policy",
  caseArea: "Case",
  tags: ["solvency"],
};

describe("deriveLibraryCardKeywords", () => {
  it("includes the whole argBlock/topic/caseArea/tags plus their individual words over two characters", () => {
    const keywords = deriveLibraryCardKeywords(WARMING_CARD);
    expect(keywords).toContain("Warming DA");
    expect(keywords).toContain("warming");
    expect(keywords).toContain("Energy Policy");
    expect(keywords).toContain("energy");
    expect(keywords).toContain("policy");
    expect(keywords).toContain("impact");
    // Short words (<= 2 chars) are dropped as individual tokens.
    expect(keywords).not.toContain("da");
  });

  it("drops blank phrases and deduplicates", () => {
    const card: LibraryCard = { ...WARMING_CARD, tags: ["warming", "  ", "warming"] };
    const keywords = deriveLibraryCardKeywords(card);
    expect(keywords.filter((k) => k === "warming")).toHaveLength(1);
  });
});

describe("suggestFlowNotesFromLibrary", () => {
  const cards = [WARMING_CARD, SOLVENCY_CARD];

  it("returns no suggestions for a blank query", () => {
    expect(suggestFlowNotesFromLibrary(cards, "")).toEqual([]);
    expect(suggestFlowNotesFromLibrary(cards, "   ")).toEqual([]);
  });

  it("returns no suggestions when nothing in the corpus overlaps the query", () => {
    expect(suggestFlowNotesFromLibrary(cards, "unrelated topic entirely")).toEqual([]);
  });

  it("matches a card whose keywords appear in the query", () => {
    const suggestions = suggestFlowNotesFromLibrary(cards, "the aff's plan has a solvency deficit");
    expect(suggestions.map((s) => s.card.id)).toEqual(["card-2"]);
    expect(suggestions[0].score).toBeGreaterThan(0);
  });

  it("ranks a card with more matching keywords above one with fewer", () => {
    const suggestions = suggestFlowNotesFromLibrary(
      cards,
      "rising emissions cause catastrophic warming impacts across the energy policy debate",
    );
    expect(suggestions[0].card.id).toBe("card-1");
    expect(suggestions[0].score).toBeGreaterThanOrEqual(suggestions[1]?.score ?? 0);
  });

  it("caps results at the given limit", () => {
    const manyCards: LibraryCard[] = Array.from({ length: 10 }, (_, i) => ({
      ...WARMING_CARD,
      id: `card-${i}`,
    }));
    const suggestions = suggestFlowNotesFromLibrary(manyCards, "warming", 3);
    expect(suggestions).toHaveLength(3);
  });

  it("breaks ties deterministically by card id", () => {
    const tiedA: LibraryCard = { ...WARMING_CARD, id: "b-card" };
    const tiedB: LibraryCard = { ...WARMING_CARD, id: "a-card" };
    const suggestions = suggestFlowNotesFromLibrary([tiedA, tiedB], "warming");
    expect(suggestions.map((s) => s.card.id)).toEqual(["a-card", "b-card"]);
  });
});

describe("buildFlowNoteFromCard", () => {
  it("formats argBlock, caseArea, topic, and tags", () => {
    expect(buildFlowNoteFromCard(WARMING_CARD)).toBe(
      "Warming DA — DA (Energy Policy) [warming, impact]",
    );
  });

  it("omits the tags suffix when a card has no tags", () => {
    const untagged: LibraryCard = { ...SOLVENCY_CARD, tags: [] };
    expect(buildFlowNoteFromCard(untagged)).toBe("Solvency — Case (Energy Policy)");
  });
});
