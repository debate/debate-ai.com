/**
 * @fileoverview Covers `htmlToCards`, the entry point every DOCX/HTML import
 * funnels through, plus the `normalizeHtmlForCards` pre-pass that turns
 * line-break-heavy paste into paragraphs the parser can segment.
 *
 * The fixtures below are shaped like real cut files: an outline of h1/h2/h3
 * headings, an h4 tag line per card, a bolded citation paragraph, then body.
 */

import { describe, expect, it } from "vitest";

import {
  htmlToCards,
  normalizeHtmlForCards,
} from "../src/parsers/html-to-cards";
import type { Card, OutlineItem } from "../src/types/types";

const CARD_FILE = `
<h1>Politics DA</h1>
<h2>Uniqueness</h2>
<h3>1NC</h3>
<h4>Plan drains capital and wrecks the agenda</h4>
<p><strong>Smith 23</strong> (Jane Smith, Senior Fellow at Brookings Institution, "Capital and the Agenda", https://brookings.edu/capital, 3-4-2023)</p>
<p>The president has limited capital and every fight <b>drains the agenda</b> further.</p>
<p></p>
<h4>Second card tag here</h4>
<p><strong>Doe 21</strong> (John Doe, Reuters, "Another Piece", 2021)</p>
<p>Body text for the second card goes here and is reasonably long.</p>
`;

const isCard = (node: Card | OutlineItem): node is Card => "summary" in node;
const cardsOf = (outline: Array<Card | OutlineItem>) => outline.filter(isCard);
const headingsOf = (outline: Array<Card | OutlineItem>) =>
  outline.filter((n): n is OutlineItem => !isCard(n));

describe("htmlToCards", () => {
  it("returns an empty result for empty input", () => {
    expect(htmlToCards("")).toEqual({
      metadata: {
        category: null,
        title: null,
        organization: null,
        year: null,
        quotes: 0,
        blocks: 0,
      },
      outline: [],
    });
  });

  it("keeps the h1/h2/h3 outline above the cards", () => {
    const headings = headingsOf(htmlToCards(CARD_FILE).outline);
    expect(headings).toEqual([
      { type: 1, text: "Politics DA" },
      { type: 2, text: "Uniqueness" },
      { type: 3, text: "1NC" },
    ]);
  });

  it("counts each h3 block and each card in the metadata", () => {
    expect(htmlToCards(CARD_FILE).metadata).toMatchObject({
      quotes: 2,
      blocks: 1,
    });
  });

  it("cuts one card per h4 tag line", () => {
    const cards = cardsOf(htmlToCards(CARD_FILE).outline);
    expect(cards).toHaveLength(2);
    expect(cards.map((c) => c.summary)).toEqual([
      "Plan drains capital and wrecks the agenda",
      "Second card tag here",
    ]);
  });

  it("reads author, year and cite off the bolded citation line", () => {
    const [first] = cardsOf(htmlToCards(CARD_FILE).outline);
    expect(first.author).toBe("Smith");
    expect(first.year).toBe(2023);
    expect(first.cite).toContain("Jane Smith");
  });

  it("pulls the source URL out of the citation line", () => {
    const [first, second] = cardsOf(htmlToCards(CARD_FILE).outline);
    expect(first.url).toBe("https://brookings.edu/capital");
    expect(second.url).toBeNull();
  });

  it("keeps inline emphasis in the card body html", () => {
    const [first] = cardsOf(htmlToCards(CARD_FILE).outline);
    expect(first.html).toContain("<b>drains the agenda</b>");
    expect(first.words).toBeGreaterThan(0);
  });

  it("flushes the final card at end of document", () => {
    const cards = cardsOf(
      htmlToCards(
        `<h4>Only card</h4>
         <p><strong>Roe 20</strong> (Jane Roe, Reuters, 2020)</p>
         <p>Body text that runs on for a little while here.</p>`,
      ).outline,
    );
    expect(cards).toHaveLength(1);
    expect(cards[0].summary).toBe("Only card");
  });

  it("records a tag with no citation as an unparsed outline entry", () => {
    const result = htmlToCards("<h4>Tag with no card under it</h4>");
    expect(cardsOf(result.outline)).toHaveLength(0);
    expect(result.outline).toEqual([
      { type: 5, text: "Tag with no card under it" },
    ]);
  });

  it("infers file metadata from the file name when given one", () => {
    expect(
      htmlToCards(CARD_FILE, "Politics DA - Harvard 2023.docx").metadata,
    ).toMatchObject({
      category: "Politics DA",
      organization: "Harvard",
      year: 2023,
    });
  });

  it("leaves file metadata null when no file name is given", () => {
    expect(htmlToCards(CARD_FILE).metadata).toMatchObject({
      category: null,
      organization: null,
      year: null,
    });
  });

  it("reads h5 tag lines under the flexible profile", () => {
    const doc = `<h5>Flexible tag line</h5>
      <p><strong>Roe 20</strong> (Jane Roe, Reuters, 2020)</p>
      <p>Body text that runs on for a little while here.</p>`;
    expect(cardsOf(htmlToCards(doc, undefined, { profile: "flexible" }).outline))
      .toHaveLength(1);
    // The standard profile stops at h4, so the same document yields nothing.
    expect(cardsOf(htmlToCards(doc).outline)).toHaveLength(0);
  });

  it("falls back to the standard profile for an unknown profile name", () => {
    expect(htmlToCards(CARD_FILE, undefined, { profile: "nope" })).toEqual(
      htmlToCards(CARD_FILE),
    );
  });

  it("lets an explicit option override the chosen profile", () => {
    const result = htmlToCards(CARD_FILE, undefined, {
      headingTags: ["h1"],
    });
    // With only h1 treated as a heading, no h4 tag line can open a card.
    expect(cardsOf(result.outline)).toHaveLength(0);
  });

  it("opens a card from a bare summary line that matches a tag pattern", () => {
    const cards = cardsOf(
      htmlToCards(
        `<p>Impact: nuclear war outweighs</p>
         <p><strong>Roe 20</strong> (Jane Roe, Reuters, 2020)</p>
         <p>Body text that runs on for a little while here.</p>`,
      ).outline,
    );
    expect(cards).toHaveLength(1);
    expect(cards[0].summary).toBe("Impact: nuclear war outweighs");
  });
});

describe("normalizeHtmlForCards", () => {
  it("returns an empty string unchanged", () => {
    expect(normalizeHtmlForCards("")).toBe("");
  });

  it("turns a blank line into a paragraph boundary", () => {
    expect(normalizeHtmlForCards("a\n\nb")).toBe("<p>a</p><p>b</p>");
  });

  it("turns a double <br> into a paragraph boundary", () => {
    expect(normalizeHtmlForCards("a<br><br>b")).toBe("<p>a</p><p>b</p>");
  });

  it("collapses any run of blank lines to a single paragraph boundary", () => {
    // Runs of 3+ newlines are first expanded into empty `<p></p>` spacers, but
    // the empty-inline-wrapper cleanup further down strips them again, so every
    // blank run lands on the same output as a plain double newline. That also
    // means `minBlankLinesForBoundary` never sees a blank block from this path.
    const oneBlank = normalizeHtmlForCards("a\n\nb");
    expect(normalizeHtmlForCards("a\n\n\nb")).toBe(oneBlank);
    expect(normalizeHtmlForCards("a\n\n\n\nb")).toBe(oneBlank);
    expect(oneBlank).not.toContain("<p></p>");
  });

  it("drops empty inline wrappers left behind by copy-paste", () => {
    expect(normalizeHtmlForCards("<p>x</p><span></span>")).toBe("<p>x</p>");
  });

  it("collapses runs of spaces and tabs", () => {
    expect(normalizeHtmlForCards("<p>a\t \tb</p>")).toBe("<p>a b</p>");
  });

  it("wraps bare text so the parser always sees paragraph tags", () => {
    const normalized = normalizeHtmlForCards("bare text");
    expect(normalized.startsWith("<")).toBe(true);
    expect(normalized.endsWith(">")).toBe(true);
  });

  it("breaks a paragraph before an inline bold citation run", () => {
    expect(normalizeHtmlForCards("tail<b>Smith 23</b>")).toContain(
      "</p><p><b>",
    );
  });
});
