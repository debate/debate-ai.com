import { describe, expect, it } from "vitest";
import {
  extractAuthor,
  extractYear,
  finalizeCard,
  getBlueShade,
  getGreenShade,
  getYearShade,
  htmlToText,
  repairCards,
} from "../src/utils/card-utils";
import type { Card, FormatProfile, MutableCard } from "../src/types/types";

/** A card as the parser hands it to `finalizeCard`: sound unless overridden. */
const card = (over: Partial<MutableCard> = {}): MutableCard => ({
  summary: "Warming is real",
  author: "Lovelace",
  author_type: null,
  cite: "Lovelace 24",
  year: 2024,
  url: "https://example.com/a",
  body: ["<p>text</p>"],
  ...over,
});

describe("extractAuthor", () => {
  it("drops a trailing four-digit year", () => {
    expect(extractAuthor("Mearsheimer 2023")).toBe("Mearsheimer");
  });

  it("keeps the label untouched when there is no trailing year", () => {
    expect(extractAuthor("Mearsheimer")).toBe("Mearsheimer");
  });

  it("only strips the year at the end of the label", () => {
    expect(extractAuthor("Report 2020 Update")).toBe("Report 2020 Update");
  });
});

describe("extractYear", () => {
  it("returns the first four-digit year in the citation", () => {
    expect(extractYear("Mearsheimer 2023")).toBe("2023");
  });

  it("returns an empty string when no year is present", () => {
    expect(extractYear("Mearsheimer")).toBe("");
  });
});

describe("getYearShade", () => {
  it("gets darker as the two-digit year gets more recent", () => {
    expect(getYearShade("25")).toBe("bg-yellow-500 text-yellow-950");
    expect(getYearShade("23")).toBe("bg-yellow-400 text-yellow-900");
    expect(getYearShade("20")).toBe("bg-yellow-100 text-yellow-600");
  });

  it("falls back to the lightest shade for old or unparsable years", () => {
    expect(getYearShade("14")).toBe("bg-yellow-50 text-yellow-500");
    expect(getYearShade("")).toBe("bg-yellow-50 text-yellow-500");
  });
});

describe("count-based badge shades", () => {
  it("scales the blue shade with the read count", () => {
    expect(getBlueShade(1000)).toContain("bg-blue-600");
    expect(getBlueShade(500)).toContain("bg-blue-500");
    expect(getBlueShade(0)).toContain("bg-blue-100");
  });

  it("scales the green shade with the word count", () => {
    expect(getGreenShade(2500)).toContain("bg-green-600");
    expect(getGreenShade(1000)).toContain("bg-green-300");
    expect(getGreenShade(10)).toContain("bg-green-100");
  });
});

describe("htmlToText", () => {
  it("unwraps highlight and underline markup", () => {
    expect(htmlToText("<mark>war</mark> is <u>bad</u>")).toBe("war is bad");
  });

  it("strips remaining tags and decodes common entities", () => {
    expect(htmlToText("<p>A&nbsp;&amp;&nbsp;B</p>")).toBe("A & B");
    expect(htmlToText("<div>&lt;tag&gt;</div>")).toBe("<tag>");
  });

  it("trims surrounding whitespace", () => {
    expect(htmlToText("  <span> spaced </span>  ")).toBe("spaced");
  });
});

describe("finalizeCard", () => {
  it("joins the captured paragraphs into the card's html", () => {
    const c = card({ body: ["<p>one</p>", "<p>two</p>"] });
    finalizeCard(c);
    expect(c.html).toBe("<p>one</p>\n<p>two</p>");
  });

  it("counts the visible words, not the tags or entities", () => {
    const c = card({ body: ["<p>one&nbsp;two</p>", "<b>three</b>"] });
    finalizeCard(c);
    expect(c.words).toBe(3);
  });

  it("extracts the highlighted text and counts it", () => {
    const c = card({ body: ["<p><mark>warming is real</mark> and other text</p>"] });
    finalizeCard(c);
    expect(c.marked).toBe("warming is real");
    expect(c.wordsMarked).toBe(3);
  });

  it("does not count the ellipsis joining two highlighted runs as a word", () => {
    const c = card({ body: ["<p><mark>a b</mark> mid <mark>c</mark></p>"] });
    finalizeCard(c, true);
    expect(c.marked).toBe("a b\u2026c");
    expect(c.wordsMarked).toBe(3);
  });

  it("clears the scratch fields the parser built the card in", () => {
    const c = card({ htmlBuffer: "<p>x" });
    finalizeCard(c);
    expect("body" in c).toBe(false);
    expect("htmlBuffer" in c).toBe(false);
  });

  it("drops the error list entirely when the card is sound", () => {
    const c = card({ body: ["<p><mark>a</mark> b</p>"] });
    finalizeCard(c);
    expect("error" in c).toBe(false);
  });

  it("flags a card with no body at all", () => {
    const c = card({ body: [] });
    finalizeCard(c);
    expect(c.error).toContain("missing_body");
    expect(c.error).toContain("empty_content");
    expect(c.html).toBe("");
    expect(c.words).toBe(0);
  });

  it("flags each missing citation field by name", () => {
    const c = card({ summary: "  ", cite: "", author: null, year: "ND" });
    finalizeCard(c);
    expect(c.error).toEqual(
      expect.arrayContaining([
        "missing_summary",
        "missing_citation",
        "missing_author",
        "missing_year",
      ]),
    );
  });

  it("flags a year outside the range a card can carry", () => {
    const tooOld = card({ year: 1899 });
    finalizeCard(tooOld);
    expect(tooOld.error).toContain("invalid_year");

    const tooNew = card({ year: new Date().getFullYear() + 2 });
    finalizeCard(tooNew);
    expect(tooNew.error).toContain("invalid_year");
  });

  it("accepts next year, which a forthcoming publication carries", () => {
    const c = card({ year: new Date().getFullYear() + 1 });
    finalizeCard(c);
    expect(c.error ?? []).not.toContain("invalid_year");
  });

  it("flags a url that is not http", () => {
    const c = card({ url: "example.com/a" });
    finalizeCard(c);
    expect(c.error).toContain("invalid_url_format");
  });

  it("accepts an http and an https url", () => {
    for (const url of ["http://example.com", "https://example.com"]) {
      const c = card({ url });
      finalizeCard(c);
      expect(c.error ?? []).not.toContain("invalid_url_format");
    }
  });
});

describe("repairCards", () => {
  const PROFILE = {} as FormatProfile;

  const parsed = (over: Partial<Card> = {}): Card => ({
    summary: "Warming is real",
    author: "Lovelace",
    author_type: null,
    cite: "Lovelace 24",
    year: 2024,
    url: null,
    html: "<p>body</p>",
    words: 100,
    ...over,
  });

  it("keeps a well-formed run of cards as it is", () => {
    expect(repairCards([parsed(), parsed({ summary: "Second" })], PROFILE)).toHaveLength(2);
  });

  it("merges a tiny unlabelled fragment into the card above it", () => {
    const cards = [
      parsed(),
      parsed({ summary: "", cite: null, author: null, words: 5, html: "<p>tail</p>" }),
    ];
    const out = repairCards(cards, PROFILE);
    expect(out).toHaveLength(1);
    expect(out[0].html).toBe("<p>body</p>\n<p>tail</p>");
    expect(out[0].words).toBe(105);
  });

  it("keeps a small fragment that carries its own citation", () => {
    expect(repairCards([parsed(), parsed({ words: 5, cite: "Hopper 24" })], PROFILE)).toHaveLength(
      2,
    );
  });

  it("keeps a small fragment that carries its own author", () => {
    const cards = [parsed(), parsed({ words: 5, cite: null, author: "Hopper" })];
    expect(repairCards(cards, PROFILE)).toHaveLength(2);
  });

  it("never merges the first card, which has nothing above it", () => {
    expect(repairCards([parsed({ words: 5, cite: null, author: null })], PROFILE)).toHaveLength(1);
  });

  it("keeps a fragment the card above cannot absorb", () => {
    const cards = [parsed({ html: undefined }), parsed({ words: 5, cite: null, author: null })];
    expect(repairCards(cards, PROFILE)).toHaveLength(2);
  });

  it("carries a merged fragment's paragraphs onto the card above", () => {
    const above = { ...parsed(), body: ["<p>body</p>"] } as Card & { body: string[] };
    const below = {
      ...parsed({ words: 5, cite: null, author: null, html: "<p>tail</p>" }),
      body: ["<p>tail</p>"],
    } as Card & { body: string[] };
    const out = repairCards([above, below], PROFILE) as (Card & { body: string[] })[];
    expect(out[0].body).toEqual(["<p>body</p>", "<p>tail</p>"]);
  });

  it("backfills a missing summary from the first visible line", () => {
    const cards = [parsed({ summary: "", html: "<p>Warming is real</p>\n<p>more</p>" })];
    expect(repairCards(cards, PROFILE)[0].summary).toBe("Warming is real");
  });

  it("caps a backfilled summary so it stays a label", () => {
    const cards = [parsed({ summary: "   ", html: `<p>${"w".repeat(400)}</p>` })];
    expect(repairCards(cards, PROFILE)[0].summary).toHaveLength(150);
  });

  it("leaves a summary that is already there alone", () => {
    expect(repairCards([parsed({ summary: "Kept", html: "<p>Other</p>" })], PROFILE)[0].summary).toBe(
      "Kept",
    );
  });

  it("leaves a card with no html to backfill from without a summary", () => {
    expect(repairCards([parsed({ summary: "", html: undefined })], PROFILE)[0].summary).toBe("");
  });

  it("is empty for no cards at all", () => {
    expect(repairCards([], PROFILE)).toEqual([]);
  });
});
