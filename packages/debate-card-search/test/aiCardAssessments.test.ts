import { beforeEach, describe, expect, it } from "vitest";
import { getAiAssessment, saveAiAssessment } from "../src/state/aiCardAssessments";
import type { CardScoringAiAssessment } from "../src/lib/llm-card-scoring-ai";

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

const ASSESSMENT: CardScoringAiAssessment = {
  overallScore: 82,
  verdict: "A strong, on-topic card with clear, usable evidence.",
  notes: {
    relevance: "Directly supports the warming argument.",
    clarity: "Sentences are well-balanced and easy to read live.",
    uniqueness: "Says something beyond common knowledge.",
    evidenceQuality: "Cites a credible, recent source.",
    usability: "A good length to read in round.",
  },
};

beforeEach(() => {
  (globalThis as unknown as { localStorage: MemoryStorage }).localStorage = new MemoryStorage();
});

describe("getAiAssessment", () => {
  it("returns undefined when nothing is stored", () => {
    expect(getAiAssessment("card-1")).toBeUndefined();
  });

  it("returns undefined when the stored value is corrupt JSON", () => {
    localStorage.setItem("aiCardAssessments", "{not json");
    expect(getAiAssessment("card-1")).toBeUndefined();
  });

  it("returns undefined when the stored value isn't an object", () => {
    localStorage.setItem("aiCardAssessments", JSON.stringify(["not", "an", "object"]));
    expect(getAiAssessment("card-1")).toBeUndefined();
  });

  it("returns undefined for an id that isn't stored", () => {
    saveAiAssessment("card-1", ASSESSMENT);
    expect(getAiAssessment("missing")).toBeUndefined();
  });
});

describe("saveAiAssessment", () => {
  it("round-trips a saved assessment", () => {
    saveAiAssessment("card-1", ASSESSMENT);
    expect(getAiAssessment("card-1")).toEqual(ASSESSMENT);
  });

  it("upserts — saving an existing id overwrites rather than duplicating it", () => {
    saveAiAssessment("card-1", ASSESSMENT);
    const revised: CardScoringAiAssessment = { ...ASSESSMENT, overallScore: 55 };
    saveAiAssessment("card-1", revised);
    expect(getAiAssessment("card-1")).toEqual(revised);
  });

  it("keeps assessments for different card ids independent", () => {
    const other: CardScoringAiAssessment = { ...ASSESSMENT, overallScore: 40 };
    saveAiAssessment("card-1", ASSESSMENT);
    saveAiAssessment("card-2", other);

    expect(getAiAssessment("card-1")).toEqual(ASSESSMENT);
    expect(getAiAssessment("card-2")).toEqual(other);
  });
});
