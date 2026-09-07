import { describe, expect, it } from "vitest";
import {
  cardAriaLabel,
  cardPreview,
  cardProvenance,
  categoryStyle,
  formatCompactCount,
  formatSeason,
  highlightRatio,
  resultCountLabel,
  splitHighlightSegments,
} from "../src/lib/card-display";
import type { SearchResult } from "../src/types";

const makeResult = (overrides: Partial<SearchResult> = {}): SearchResult => ({
  id: 1,
  category: "DA",
  researchField: "Energy",
  readCount: 120,
  word_count: 480,
  argBlock: "Warming DA",
  summary: "Emissions growth locks in feedback loops.",
  tag: "Warming causes extinction",
  cite_short: "Mearsheimer 2024",
  cite: "Mearsheimer, John. 2024.",
  highlightLength: 60,
  textLength: 600,
  html: "<p>x</p>",
  year: "24",
  page: "1",
  ...overrides,
});

describe("categoryStyle", () => {
  it("maps a known category to its palette", () => {
    expect(categoryStyle("DA").label).toBe("DA");
    expect(categoryStyle("da").accent).toBe("bg-rose-500");
  });

  it("expands abbreviated categories to readable labels", () => {
    expect(categoryStyle("I").label).toBe("Impact");
  });

  it("keeps an unknown category's own label", () => {
    expect(categoryStyle("Theory").label).toBe("Theory");
  });

  it("falls back when the category is missing", () => {
    expect(categoryStyle(undefined).label).toBe("Card");
  });
});

describe("formatCompactCount", () => {
  it("leaves small counts alone", () => {
    expect(formatCompactCount(0)).toBe("0");
    expect(formatCompactCount(999)).toBe("999");
  });

  it("abbreviates thousands and millions", () => {
    expect(formatCompactCount(1234)).toBe("1.2k");
    expect(formatCompactCount(14_500)).toBe("14k");
    expect(formatCompactCount(2_400_000)).toBe("2.4m");
  });

  it("treats missing and negative counts as zero", () => {
    expect(formatCompactCount(undefined)).toBe("0");
    expect(formatCompactCount(-5)).toBe("0");
  });
});

describe("formatSeason", () => {
  it("expands a two-digit year into a season", () => {
    expect(formatSeason("24")).toBe("2023-24");
  });

  it("accepts a four-digit year", () => {
    expect(formatSeason("2019")).toBe("2018-19");
  });

  it("returns an empty string for unusable input", () => {
    expect(formatSeason("")).toBe("");
    expect(formatSeason("n/a")).toBe("");
  });
});

describe("cardProvenance", () => {
  it("orders provenance the way a card is scanned", () => {
    const result = makeResult({
      school: "Michigan",
      team: "KM",
      tournament: "NDT",
      round: "Octas",
      side: "Neg",
    });
    expect(cardProvenance(result)).toEqual([
      "Michigan",
      "KM",
      "NDT",
      "Octas",
      "Neg",
      "2023-24",
    ]);
  });

  it("drops blank fields instead of rendering empty separators", () => {
    expect(cardProvenance(makeResult({ school: "  ", year: "" }))).toEqual([]);
  });
});

describe("cardPreview", () => {
  it("collapses whitespace in the summary", () => {
    expect(cardPreview(makeResult({ summary: "a\n\n  b" }))).toBe("a b");
  });

  it("falls back to the tag, then the block, when there is no summary", () => {
    expect(cardPreview(makeResult({ summary: "" }))).toBe("Warming causes extinction");
    expect(cardPreview(makeResult({ summary: "", tag: "" }))).toBe("Warming DA");
  });

  it("returns an empty string when the card has no text at all", () => {
    expect(cardPreview(makeResult({ summary: "", tag: "", argBlock: "" }))).toBe("");
  });

  it("truncates on a word boundary", () => {
    const preview = cardPreview(makeResult({ summary: "alpha beta gamma delta" }), 14);
    expect(preview).toBe("alpha beta…");
  });

  it("hard-clips a single long word rather than returning nothing", () => {
    const preview = cardPreview(makeResult({ summary: "a".repeat(40) }), 10);
    expect(preview).toBe(`${"a".repeat(10)}…`);
  });
});

describe("highlightRatio", () => {
  it("reports the highlighted fraction", () => {
    expect(highlightRatio(makeResult())).toBeCloseTo(0.1);
  });

  it("clamps a ratio above one", () => {
    expect(highlightRatio(makeResult({ highlightLength: 900, textLength: 600 }))).toBe(1);
  });

  it("returns null when there is no length data", () => {
    expect(highlightRatio(makeResult({ textLength: 0 }))).toBeNull();
    expect(highlightRatio(makeResult({ highlightLength: Number.NaN }))).toBeNull();
  });
});

describe("splitHighlightSegments", () => {
  it("marks the query terms inside the text", () => {
    expect(splitHighlightSegments("Warming causes extinction", "warming")).toEqual([
      { text: "Warming", match: true },
      { text: " causes extinction", match: false },
    ]);
  });

  it("re-joins to exactly the input text", () => {
    const text = "Emissions growth locks in warming feedback loops";
    const joined = splitHighlightSegments(text, "warming growth")
      .map((segment) => segment.text)
      .join("");
    expect(joined).toBe(text);
  });

  it("treats search punctuation as plain words rather than a pattern", () => {
    const segments = splitHighlightSegments("warming (a+b) risk", '"warming" -risk (a+b)');
    expect(segments.filter((segment) => segment.match).map((segment) => segment.text)).toEqual([
      "warming",
      "risk",
    ]);
  });

  it("ignores one-character noise in the query", () => {
    expect(splitHighlightSegments("a warming card", "a")).toEqual([
      { text: "a warming card", match: false },
    ]);
  });

  it("returns a single unmatched run when there is no query", () => {
    expect(splitHighlightSegments("Warming", "")).toEqual([{ text: "Warming", match: false }]);
  });

  it("returns nothing for empty text", () => {
    expect(splitHighlightSegments("", "warming")).toEqual([]);
  });
});

describe("cardAriaLabel", () => {
  it("describes position, category, tag, citation and provenance", () => {
    const label = cardAriaLabel(makeResult({ school: "Michigan" }), 2, 40);
    expect(label).toBe(
      "Result 2 of 40. DA. Warming causes extinction. Mearsheimer 2024. Michigan, 2023-24. 480 words",
    );
  });

  it("names an untitled card rather than leaving a gap", () => {
    expect(cardAriaLabel(makeResult({ tag: "", argBlock: "" }), 1, 1)).toContain("Untitled card");
  });
});

describe("resultCountLabel", () => {
  it("reports the shown count when it is the whole set", () => {
    expect(resultCountLabel(1, 1)).toBe("1 card");
    expect(resultCountLabel(20, 20)).toBe("20 cards");
  });

  it("reports the shown count against the total", () => {
    expect(resultCountLabel(20, 1543)).toBe("20 of 1,543 cards");
  });

  it("says nothing when there are no results", () => {
    expect(resultCountLabel(0, 0)).toBe("");
  });
});
