/**
 * @fileoverview Covers the citation heuristics that turn a card's bolded cite
 * line into an author and a year. Debaters cite by author-and-year, so these
 * two fields are what a mis-parse actually costs them.
 */

import { describe, expect, it } from "vitest";

import {
  cleanUrl,
  extractCiteInfo,
  recalculateAuthor,
} from "../src/extractors/citation-extractor";
import { FORMAT_PROFILES } from "../src/utils/format-profiles";

describe("extractCiteInfo", () => {
  it("returns empty fields when nothing was bolded", () => {
    expect(extractCiteInfo("Jane Smith, Reuters, 2021", "")).toEqual({
      author: null,
      year: null,
      author_type: null,
    });
  });

  it('reads the common "Lastname YY" opening', () => {
    expect(extractCiteInfo("Smith 23 (Jane Smith, Brookings)", "Smith 23")).toMatchObject(
      { author: "Smith", year: 2023 },
    );
  });

  it("reads a four-digit year", () => {
    expect(
      extractCiteInfo("Smith 2018 (Jane Smith, Brookings)", "Smith 2018"),
    ).toMatchObject({ author: "Smith", year: 2018 });
  });

  it("expands a two-digit year at the 1930/2030 boundary", () => {
    expect(extractCiteInfo("Smith 30 report", "Smith 30").year).toBe(2030);
    expect(extractCiteInfo("Smith 31 report", "Smith 31").year).toBe(1931);
    expect(extractCiteInfo("Smith 99 report", "Smith 99").year).toBe(1999);
    expect(extractCiteInfo("Smith 05 report", "Smith 05").year).toBe(2005);
  });

  it("reads an apostrophe year out of the bolded fragment", () => {
    expect(extractCiteInfo("Jane Smith, '19, Reuters", "'19").year).toBe(2019);
  });

  it("recovers a surname when only a stray quote was bolded", () => {
    expect(extractCiteInfo("Jane Smith '19, Reuters", "'").author).toBe("Smith");
  });

  it("rejects a one-character author guess", () => {
    // A lone initial is not a usable cite, so the extractor drops it rather
    // than putting "J" on the card.
    expect(extractCiteInfo("J '19", "'").author).toBeNull();
  });

  it("re-runs inference when the first guess reads like a phrase", () => {
    // "Of The" are common short words, so the phrase is rejected and the
    // stricter surname pass runs instead.
    const info = extractCiteInfo(
      "Some Long Phrase Of The Thing",
      "Some Long Phrase Of The Thing",
    );
    expect(info.author).not.toContain(" ");
  });
});

describe("recalculateAuthor", () => {
  it("prefers an explicit Last, First form", () => {
    expect(recalculateAuthor("Smith, Jane writes that", "")).toBe("Smith");
  });

  it("takes the surname from a leading First Last pair", () => {
    expect(recalculateAuthor("Jane Smith writes that", "")).toBe("Smith");
  });

  it("reads a parenthesized author mention", () => {
    expect(recalculateAuthor("as noted (Jane Smith) in the paper", "")).toBe(
      "Smith",
    );
  });

  it("reads a bracketed author mention", () => {
    expect(recalculateAuthor("as noted [Jane Smith] in the paper", "")).toBe(
      "Smith",
    );
  });

  it("scans mid-sentence for an adjacent capitalized pair", () => {
    expect(recalculateAuthor("a study by Jane Smith", "")).toBe("Smith");
  });

  it("skips capitalized common words during the mid-sentence scan", () => {
    // "Of"/"The"/"A" are filtered out, so the scan keeps walking rather than
    // returning the first capitalized token it trips over.
    expect(recalculateAuthor("a study of The Event by Jane Smith", "")).toBe(
      "Smith",
    );
  });

  it("returns null when there is nothing name-shaped to find", () => {
    expect(recalculateAuthor("", "")).toBeNull();
  });
});

describe("cleanUrl", () => {
  it.each([
    ["https://a.com/x.", "https://a.com/x"],
    ["https://a.com/y),", "https://a.com/y"],
    ["https://a.com/z]", "https://a.com/z"],
    ["https://a.com/w>", "https://a.com/w"],
  ])("strips trailing punctuation from %j", (input, expected) => {
    expect(cleanUrl(input)).toBe(expected);
  });

  it("leaves a clean url alone", () => {
    expect(cleanUrl("https://a.com/z")).toBe("https://a.com/z");
  });

  it("keeps a trailing slash, which is part of the url", () => {
    expect(cleanUrl("https://a.com/dir/")).toBe("https://a.com/dir/");
  });
});

describe("FORMAT_PROFILES", () => {
  it("ships a standard profile the parser falls back to", () => {
    expect(FORMAT_PROFILES.standard).toBeDefined();
  });

  it("gives every profile a usable shape", () => {
    for (const [name, profile] of Object.entries(FORMAT_PROFILES)) {
      expect(profile.headingTags.length, name).toBeGreaterThan(0);
      expect(profile.cardStartHeadings.length, name).toBeGreaterThan(0);
      expect(profile.minBlankLinesForBoundary, name).toBeGreaterThanOrEqual(0);
      expect(Array.isArray(profile.summaryPatterns), name).toBe(true);
      expect(typeof profile.trustParagraphTags, name).toBe("boolean");
    }
  });

  it("lets the flexible profile reach deeper headings than the standard one", () => {
    expect(FORMAT_PROFILES.flexible.headingTags.length).toBeGreaterThan(
      FORMAT_PROFILES.standard.headingTags.length,
    );
  });

  it("matches an Aff/Neg tag line with the standard summary patterns", () => {
    const matches = (text: string) =>
      FORMAT_PROFILES.standard.summaryPatterns.some((p) => p.test(text));
    expect(matches("Aff - warming is real")).toBe(true);
    expect(matches("Impact: nuclear war")).toBe(true);
    expect(matches("1. First argument")).toBe(true);
  });
});
