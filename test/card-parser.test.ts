import { describe, expect, it } from "vitest";

import { normalizeHtmlForCards } from "../lib/card-parser/parsers/html-to-cards";
import {
  extractMarked,
  extractUnderlined,
} from "../lib/card-parser/extractors/text-extractor";
import {
  extractCiteInfo,
  recalculateAuthor,
  cleanUrl,
} from "../lib/card-parser/extractors/citation-extractor";
import {
  extractAuthor,
  extractYear,
  finalizeCard,
  getBlueShade,
  getYearShade,
  htmlToText,
  repairCards,
} from "../lib/card-parser/utils/card-utils";
import { parseFileNameParts } from "../lib/card-parser/extractors/file-name-parser";
import type { MutableCard, Card } from "../lib/card-parser/types/types";

describe("card parser utilities", () => {
  it("normalizes newline-heavy blobs into paragraph markup", () => {
    const normalized = normalizeHtmlForCards(
      "Line one\n\nLine two\n\n\nLine three",
    );
    expect(normalized.startsWith("<p>")).toBe(true);
    expect(normalized).toContain("</p><p>");
    expect(normalized).toContain("Line one");
    expect(normalized).toContain("Line three");
  });

  it("extracts highlighted and underlined snippets", () => {
    expect(extractMarked("<p><mark>lead</mark> <mark>support</mark></p>")).toBe(
      "lead…support",
    );
    expect(extractMarked("<mark>one</mark><mark>two</mark>", false)).toBe(
      "one two",
    );
    expect(extractUnderlined("<p><u>first</u><u>second</u></p>")).toEqual([
      "first",
      "second",
    ]);
  });

  it("cleans trailing punctuation from URLs", () => {
    expect(cleanUrl("https://example.com/page).")).toBe(
      "https://example.com/page",
    );
  });

  it("recalculates authors from varied citation lines", () => {
    expect(recalculateAuthor("Smith, John", "")).toBe("Smith");
    expect(recalculateAuthor("Doe, Jane", "")).toBe("Doe");
  });

  it("extracts citation metadata from simple references", () => {
    const citation = extractCiteInfo("Johnson 2023 Evidence", "Johnson 2023");
    expect(citation.author).toBe("Johnson");
    expect(citation.year).toBe(2023);
  });

  it("extracts text without markup for UI display", () => {
    expect(htmlToText("<p><mark>Hi</mark> &amp; <u>there</u></p>")).toBe(
      "Hi & there",
    );
    expect(extractAuthor("Smith 2024")).toBe("Smith");
    expect(extractYear("Smith 2024")).toBe("2024");
  });

  it("finalizes cards and flags missing data", () => {
    const card: MutableCard = {
      summary: "Test",
      cite: "Smith 2022",
      author: "Smith",
      author_type: 1,
      year: 2022,
      url: "https://example.com",
      body: ["<p>Evidence <mark>Highlight</mark></p>"],
    };

    finalizeCard(card);
    expect(card.html).toBe("<p>Evidence <mark>Highlight</mark></p>");
    expect(card.marked).toBe("Highlight");
    expect(card.words).toBe(2);
    expect(card.wordsMarked).toBe(1);
    expect(card.error).toBeUndefined();
  });

  it("repairs cards by backfilling summaries and merging tiny fragments", () => {
    const cards: Card[] = [
      {
        summary: "",
        author: "Author",
        author_type: 1,
        cite: "Author 2021",
        year: 2021,
        url: "https://example.com",
        html: "<p>Lead line works</p>",
        words: 30,
        wordsMarked: 0,
      },
      {
        summary: "",
        author: null,
        author_type: null,
        cite: null,
        year: null,
        url: null,
        html: "<p>Tiny detail</p>",
        words: 5,
        wordsMarked: 0,
      },
    ];

    const repaired = repairCards(cards, {
      headingTags: [],
      cardStartHeadings: [],
      minBlankLinesForBoundary: 0,
      trustParagraphTags: true,
      summaryPatterns: [],
    });

    expect(repaired).toHaveLength(1);
    expect(repaired[0].summary).toBe("Lead line works");
    expect(repaired[0].html).toContain("Tiny detail");
  });

  it("parses metadata from file names and shades counts", () => {
    expect(
      parseFileNameParts("Evidence - Climate - Harvard 2024.docx"),
    ).toEqual({
      category: "Evidence",
      topic: "Climate",
      organization: "Harvard",
      year: 2024,
    });
    expect(getBlueShade(1200)).toContain("bg-blue-600");
    expect(getYearShade("22")).toBe("bg-yellow-300 text-yellow-800");
  });
});
