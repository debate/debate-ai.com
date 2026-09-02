import { describe, expect, it } from "vitest";
import {
  DEFAULT_CARD_SCORE_WEIGHTS,
  buildCardScoreSummaryText,
  computeCardScoreBreakdown,
  deriveArgBlockKeywords,
  parseBulkCardSubmissions,
  rankCardScores,
  scoreClarity,
  scoreEvidenceQuality,
  scoreRelevance,
  scoreUniqueness,
  scoreUsability,
  type ScoredCard,
} from "../src/lib/llm-card-scoring";

function repeatWords(word: string, count: number): string {
  return Array.from({ length: count }, () => word).join(" ");
}

function sentence(wordCount: number): string {
  return `${repeatWords("word", wordCount)}.`;
}

describe("scoreRelevance", () => {
  it("scores 0 when there are no keywords to confirm relevance", () => {
    expect(scoreRelevance("warming causes extinction", [])).toBe(0);
  });

  it("scores 100 when every keyword phrase is found in the text", () => {
    const text = "Warming causes ocean acidification and biodiversity loss across ecosystems.";
    expect(scoreRelevance(text, ["warming", "ocean acidification", "biodiversity loss"])).toBe(100);
  });

  it("scores the partial match share when only some keywords are found", () => {
    const text = "Warming causes ocean acidification.";
    expect(scoreRelevance(text, ["warming", "nuclear war", "biodiversity loss", "acidification"])).toBe(50);
  });

  it("matches case-insensitively and ignores blank keywords", () => {
    const text = "The WARMING trend accelerates.";
    expect(scoreRelevance(text, ["warming", "  ", ""])).toBe(100);
  });
});

describe("scoreClarity", () => {
  it("scores 0 for empty text", () => {
    expect(scoreClarity("")).toBe(0);
  });

  it("scores 100 for sentences within the ideal length band", () => {
    const text = `${sentence(18)} ${sentence(20)}`;
    expect(scoreClarity(text)).toBe(100);
  });

  it("penalizes sentences that are too short on average", () => {
    const text = `${sentence(3)} ${sentence(4)}`;
    expect(scoreClarity(text)).toBeLessThan(100);
    expect(scoreClarity(text)).toBeGreaterThanOrEqual(0);
  });

  it("penalizes sentences that are too long on average", () => {
    const text = sentence(60);
    expect(scoreClarity(text)).toBeLessThan(100);
  });

  it("clamps to 0 for extremely long run-on sentences", () => {
    expect(scoreClarity(sentence(200))).toBe(0);
  });
});

describe("scoreUniqueness", () => {
  it("scores 100 when there is nothing to compare against", () => {
    expect(scoreUniqueness("any card text here", [])).toBe(100);
  });

  it("scores 0 for text identical to an existing corpus entry", () => {
    const text = "the impact outweighs on magnitude and reversibility";
    expect(scoreUniqueness(text, [text])).toBe(0);
  });

  it("scores 100 for text sharing no vocabulary with the corpus", () => {
    expect(scoreUniqueness("alpha bravo charlie", ["delta echo foxtrot"])).toBe(100);
  });

  it("scores against the most similar corpus entry, not an average", () => {
    const text = "alpha bravo charlie delta";
    const nearDuplicate = "alpha bravo charlie delta";
    const unrelated = "zulu yankee xray";
    expect(scoreUniqueness(text, [unrelated, nearDuplicate])).toBe(0);
  });
});

describe("scoreEvidenceQuality", () => {
  it("delegates directly to community-rating's quality-signal scoring", () => {
    expect(scoreEvidenceQuality([0.8, 0.6])).toBe(70);
    expect(scoreEvidenceQuality([])).toBe(0);
  });
});

describe("deriveArgBlockKeywords", () => {
  it("returns an empty list for an empty or all-blank input", () => {
    expect(deriveArgBlockKeywords([])).toEqual([]);
    expect(deriveArgBlockKeywords(["", "   "])).toEqual([]);
  });

  it("keeps each trimmed label whole, plus its individual words", () => {
    const keywords = deriveArgBlockKeywords(["Warming DA"]);
    expect(keywords).toContain("Warming DA");
    expect(keywords).toContain("warming");
  });

  it("drops words of two characters or fewer so short tags like 'DA'/'CP' don't drown out real words", () => {
    const keywords = deriveArgBlockKeywords(["Warming DA"]);
    expect(keywords).not.toContain("da");
  });

  it("deduplicates keywords shared across multiple labels", () => {
    const keywords = deriveArgBlockKeywords(["Warming DA", "Warming Impact"]);
    expect(keywords.filter((keyword) => keyword === "warming")).toHaveLength(1);
  });

  it("scores relevance against a card matching only part of a tracked block's name", () => {
    const keywords = deriveArgBlockKeywords(["Warming DA"]);
    const text = "Rising emissions accelerate catastrophic warming impacts worldwide.";
    expect(scoreRelevance(text, keywords)).toBeGreaterThan(0);
  });
});

describe("scoreUsability", () => {
  it("scores 0 for zero or negative word counts", () => {
    expect(scoreUsability(0)).toBe(0);
    expect(scoreUsability(-5)).toBe(0);
  });

  it("scores 100 within the ideal word-count band", () => {
    expect(scoreUsability(150)).toBe(100);
    expect(scoreUsability(500)).toBe(100);
    expect(scoreUsability(300)).toBe(100);
  });

  it("penalizes cards that are too short", () => {
    expect(scoreUsability(50)).toBeLessThan(100);
  });

  it("penalizes cards that are too long", () => {
    expect(scoreUsability(900)).toBeLessThan(100);
  });
});

const baseCard: ScoredCard = {
  id: "card-1",
  text: `${sentence(15)} ${sentence(18)} ${repeatWords("evidence", 148)}.`,
  argBlockKeywords: ["evidence"],
  qualitySignals: [0.8, 0.8],
};

describe("computeCardScoreBreakdown", () => {
  it("blends all five dimensions into a weighted overall score", () => {
    const breakdown = computeCardScoreBreakdown(baseCard);
    expect(breakdown.cardId).toBe("card-1");
    expect(breakdown.relevanceScore).toBe(100);
    expect(breakdown.evidenceQualityScore).toBe(80);
    expect(breakdown.overallScore).toBeGreaterThan(0);
    expect(breakdown.overallScore).toBeLessThanOrEqual(100);
  });

  it("flags a card as a likely duplicate when uniqueness is very low", () => {
    const breakdown = computeCardScoreBreakdown(baseCard, [baseCard.text]);
    expect(breakdown.uniquenessScore).toBeLessThan(25);
    expect(breakdown.isLikelyDuplicate).toBe(true);
  });

  it("does not flag a card with no comparison corpus as a duplicate", () => {
    const breakdown = computeCardScoreBreakdown(baseCard, []);
    expect(breakdown.isLikelyDuplicate).toBe(false);
  });

  it("honors custom weights", () => {
    const allRelevance = { relevance: 1, clarity: 0, uniqueness: 0, evidenceQuality: 0, usability: 0 };
    const breakdown = computeCardScoreBreakdown(baseCard, [], allRelevance);
    expect(breakdown.overallScore).toBe(breakdown.relevanceScore);
  });

  it("defaults to DEFAULT_CARD_SCORE_WEIGHTS when none are given", () => {
    const explicit = computeCardScoreBreakdown(baseCard, [], DEFAULT_CARD_SCORE_WEIGHTS);
    const implicit = computeCardScoreBreakdown(baseCard, []);
    expect(implicit).toEqual(explicit);
  });
});

describe("rankCardScores", () => {
  it("ranks cards by overall score descending", () => {
    const strongCard: ScoredCard = baseCard;
    const weakCard: ScoredCard = {
      id: "card-2",
      text: "x.",
      argBlockKeywords: ["something else entirely"],
      qualitySignals: [0.1],
    };
    const ranked = rankCardScores([weakCard, strongCard]);
    expect(ranked.map((entry) => entry.cardId)).toEqual(["card-1", "card-2"]);
    expect(ranked[0].overallScore).toBeGreaterThan(ranked[1].overallScore);
  });

  it("checks uniqueness against other cards in the same batch, not just an external corpus", () => {
    const duplicateA: ScoredCard = { ...baseCard, id: "dup-a" };
    const duplicateB: ScoredCard = { ...baseCard, id: "dup-b" };
    const ranked = rankCardScores([duplicateA, duplicateB]);
    expect(ranked.every((entry) => entry.isLikelyDuplicate)).toBe(true);
  });

  it("breaks ties by cardId", () => {
    const tiedA: ScoredCard = { ...baseCard, id: "zeta" };
    const tiedB: ScoredCard = { ...baseCard, id: "alpha" };
    const ranked = rankCardScores([tiedA, tiedB], [], {
      relevance: 0,
      clarity: 0,
      uniqueness: 0,
      evidenceQuality: 1,
      usability: 0,
    });
    expect(ranked.map((entry) => entry.cardId)).toEqual(["alpha", "zeta"]);
  });

  it("returns an empty list for an empty input", () => {
    expect(rankCardScores([])).toEqual([]);
  });
});

describe("parseBulkCardSubmissions", () => {
  it("returns no entries for blank input", () => {
    expect(parseBulkCardSubmissions("")).toEqual({ entries: [], skippedCount: 0 });
    expect(parseBulkCardSubmissions("   \n  ")).toEqual({ entries: [], skippedCount: 0 });
  });

  it("parses a single entry with no separator", () => {
    const { entries, skippedCount } = parseBulkCardSubmissions("id: card-1\nkeywords: warming, emissions\nCard text here.");
    expect(skippedCount).toBe(0);
    expect(entries).toEqual([
      { id: "card-1", text: "Card text here.", argBlockKeywords: ["warming", "emissions"], quality: 0.5 },
    ]);
  });

  it("parses multiple entries separated by a dashed line", () => {
    const raw = ["id: card-1", "First card text.", "---", "id: card-2", "Second card text."].join("\n");
    const { entries } = parseBulkCardSubmissions(raw);
    expect(entries.map((entry) => entry.id)).toEqual(["card-1", "card-2"]);
    expect(entries.map((entry) => entry.text)).toEqual(["First card text.", "Second card text."]);
  });

  it("accepts a longer dashed separator", () => {
    const raw = "id: card-1\nFirst.\n-----\nid: card-2\nSecond.";
    const { entries } = parseBulkCardSubmissions(raw);
    expect(entries).toHaveLength(2);
  });

  it("parses metadata lines in any order", () => {
    const raw = "keywords: warming\nquality: 0.9\nid: card-1\nCard text.";
    const { entries } = parseBulkCardSubmissions(raw);
    expect(entries[0]).toEqual({ id: "card-1", text: "Card text.", argBlockKeywords: ["warming"], quality: 0.9 });
  });

  it("skips an entry missing an id and counts it", () => {
    const { entries, skippedCount } = parseBulkCardSubmissions("keywords: warming\nCard text.");
    expect(entries).toEqual([]);
    expect(skippedCount).toBe(1);
  });

  it("skips an entry with no text after its metadata and counts it", () => {
    const { entries, skippedCount } = parseBulkCardSubmissions("id: card-1\nkeywords: warming");
    expect(entries).toEqual([]);
    expect(skippedCount).toBe(1);
  });

  it("does not count a fully blank block (e.g. a trailing separator) as skipped", () => {
    const raw = "id: card-1\nCard text.\n---\n   \n";
    const { entries, skippedCount } = parseBulkCardSubmissions(raw);
    expect(entries).toHaveLength(1);
    expect(skippedCount).toBe(0);
  });

  it("keeps well-formed entries even when a sibling entry is malformed", () => {
    const raw = ["id: card-1", "Good card.", "---", "keywords: no-id-here", "---", "id: card-3", "Also good."].join(
      "\n",
    );
    const { entries, skippedCount } = parseBulkCardSubmissions(raw);
    expect(entries.map((entry) => entry.id)).toEqual(["card-1", "card-3"]);
    expect(skippedCount).toBe(1);
  });

  it("preserves multi-line card text", () => {
    const raw = "id: card-1\nFirst line.\nSecond line.";
    const { entries } = parseBulkCardSubmissions(raw);
    expect(entries[0].text).toBe("First line.\nSecond line.");
  });

  it("trims and drops blank keyword entries", () => {
    const raw = "id: card-1\nkeywords: warming ,  , emissions ,\nCard text.";
    const { entries } = parseBulkCardSubmissions(raw);
    expect(entries[0].argBlockKeywords).toEqual(["warming", "emissions"]);
  });

  it("defaults keywords to an empty list when the line is omitted", () => {
    const { entries } = parseBulkCardSubmissions("id: card-1\nCard text.");
    expect(entries[0].argBlockKeywords).toEqual([]);
  });

  it("clamps an out-of-range quality value", () => {
    const { entries } = parseBulkCardSubmissions("id: card-1\nquality: 4\nCard text.");
    expect(entries[0].quality).toBe(1);
  });

  it("falls back to the given default quality when the value is unparseable", () => {
    const { entries } = parseBulkCardSubmissions("id: card-1\nquality: not-a-number\nCard text.", 0.7);
    expect(entries[0].quality).toBe(0.7);
  });

  it("falls back to 0.5 quality by default when omitted", () => {
    const { entries } = parseBulkCardSubmissions("id: card-1\nCard text.");
    expect(entries[0].quality).toBe(0.5);
  });
});

describe("buildCardScoreSummaryText", () => {
  it("renders a full breakdown line for a non-duplicate card", () => {
    const breakdown = computeCardScoreBreakdown(baseCard, []);
    const text = buildCardScoreSummaryText(breakdown);
    expect(text).toContain('Card "card-1" scored');
    expect(text).toContain("relevance 100");
    expect(text).toContain("evidence 80");
  });

  it("renders a duplicate-flagged line when the card is a likely duplicate", () => {
    const breakdown = computeCardScoreBreakdown(baseCard, [baseCard.text]);
    const text = buildCardScoreSummaryText(breakdown);
    expect(text).toContain("flagged as a likely duplicate");
  });
});
