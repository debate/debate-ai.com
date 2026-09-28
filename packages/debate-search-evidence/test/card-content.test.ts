import { describe, expect, it } from "vitest";

import {
  citationDetail,
  extractAuthor,
  extractYear,
  normalizeText,
  plainText,
  stripDuplicateHeader,
} from "../src/lib/card-content";

describe("plainText", () => {
  it("drops markup and collapses whitespace", () => {
    expect(plainText("<h4>Nuclear   <mark>deterrence</mark>\n solves</h4>")).toBe("Nuclear deterrence solves");
  });

  it("decodes the entities card markup carries", () => {
    expect(plainText("<p>Risk&nbsp;&amp; reward &quot;now&quot;</p>")).toBe('Risk & reward "now"');
  });
});

describe("normalizeText", () => {
  it("ignores casing, punctuation and curly quotes", () => {
    expect(normalizeText("The Aff’s “plan” — solves!")).toBe(normalizeText("the affs plan solves"));
  });
});

describe("extractAuthor", () => {
  it("drops a two-digit season year", () => {
    expect(extractAuthor("Chilton 18")).toBe("Chilton");
  });

  it("drops a four-digit year", () => {
    expect(extractAuthor("Smith 2024")).toBe("Smith");
  });

  it("keeps an author that carries no year", () => {
    expect(extractAuthor("Birhane and van Dijk")).toBe("Birhane and van Dijk");
  });

  it("keeps the rest of a multi-author citation", () => {
    expect(extractAuthor("Blum et al. 18")).toBe("Blum et al.");
  });
});

describe("extractYear", () => {
  it("reads a four-digit indexed year as two digits", () => {
    expect(extractYear("2018")).toBe("18");
  });

  it("passes a two-digit year through", () => {
    expect(extractYear("24")).toBe("24");
  });

  it("falls back to the short citation when the indexed year is missing", () => {
    expect(extractYear("", "Chilton 18")).toBe("18");
  });

  it("returns nothing when no candidate carries a year", () => {
    expect(extractYear("", "Birhane and van Dijk")).toBe("");
  });
});

describe("citationDetail", () => {
  it("drops a citation that only repeats the author line", () => {
    expect(citationDetail("Chilton 18", "Chilton 18")).toBe("");
  });

  it("keeps a citation that qualifies the author", () => {
    const cite = "Chilton 18 — USAF, Retired Former commander, US Strategic Command";
    expect(citationDetail(cite, "Chilton 18")).toBe(cite);
  });

  it("returns nothing for a blank citation", () => {
    expect(citationDetail("", "Chilton 18")).toBe("");
  });
});

describe("stripDuplicateHeader", () => {
  const tag = "Nuclear deterrence solves existential threats";

  it("removes the card's own tag heading, which the header already shows", () => {
    const html = `<h4>${tag}</h4><p>Chilton 18—USAF, Retired. <mark>Deterrence underpins</mark> security.</p>`;
    const stripped = stripDuplicateHeader(html, [tag, "Chilton 18"]);

    expect(stripped).not.toContain("<h4>");
    expect(stripped).toContain("Deterrence underpins");
  });

  it("keeps the citation paragraph that says more than the header does", () => {
    const html = `<h4>${tag}</h4><p>Chilton 18—USAF, Retired Former commander</p><p>Body.</p>`;
    const stripped = stripDuplicateHeader(html, [tag, "Chilton 18"]);

    expect(stripped).toContain("USAF, Retired Former commander");
  });

  it("removes a citation line the header repeats verbatim", () => {
    const html = `<h4>${tag}</h4><p>Chilton 18</p><p>Body text.</p>`;
    const stripped = stripDuplicateHeader(html, [tag, "Chilton 18"]);

    expect(stripped).toBe("<p>Body text.</p>");
  });

  it("stops at the first block with something new to say", () => {
    const html = `<h4>${tag}</h4><p>First body line.</p><h4>${tag}</h4><p>Later.</p>`;
    const stripped = stripDuplicateHeader(html, [tag]);

    // The tag repeated mid-card is the debater's own structure, not chrome.
    expect(stripped).toBe(`<p>First body line.</p><h4>${tag}</h4><p>Later.</p>`);
  });

  it("ignores punctuation and casing differences between the two copies", () => {
    const html = `<h4><strong>NUCLEAR DETERRENCE SOLVES EXISTENTIAL THREATS!</strong></h4><p>Body.</p>`;
    expect(stripDuplicateHeader(html, [tag])).toBe("<p>Body.</p>");
  });

  it("skips over empty spacer blocks before the duplicated heading", () => {
    const html = `<p>&nbsp;</p><h4>${tag}</h4><p>Body.</p>`;
    expect(stripDuplicateHeader(html, [tag])).toBe("<p>Body.</p>");
  });

  it("leaves a body that never repeated the header alone", () => {
    const html = "<p>A card body that opens straight into its evidence.</p>";
    expect(stripDuplicateHeader(html, [tag, "Chilton 18"])).toBe(html);
  });

  it("returns the body untouched when there is no header text to match", () => {
    const html = `<h4>${tag}</h4><p>Body.</p>`;
    expect(stripDuplicateHeader(html, ["", undefined])).toBe(html);
  });

  it("handles nested blocks of the same tag without eating the body", () => {
    const html = `<div><div>${tag}</div></div><p>Body.</p>`;
    expect(stripDuplicateHeader(html, [tag])).toBe("<p>Body.</p>");
  });

  it("handles an empty body", () => {
    expect(stripDuplicateHeader("", [tag])).toBe("");
  });
});
