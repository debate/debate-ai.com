/**
 * @fileoverview Covers `parseCardRecord`, which turns one Parquet dump row's
 * cite and markup columns into the source URL the reuse check indexes and the
 * quotes the extension shows.
 */

import { describe, expect, it } from "vitest";

import { extractSourceUrl, parseCardRecord } from "../src/extractors/card-record";

describe("extractSourceUrl", () => {
  it("finds a URL inside bracketed credentials and drops trailing punctuation", () => {
    expect(
      extractSourceUrl(
        'Smith 23 [Jane Smith, Professor at MIT, "AI and Jobs," Brookings, 1-2-2023, https://www.brookings.edu/ai-jobs/.] accessed 2-1-23',
      ),
    ).toBe("https://www.brookings.edu/ai-jobs/");
  });

  it("gives a scheme-less www. URL back an https scheme", () => {
    expect(extractSourceUrl("Doe 19 (Reuters, www.reuters.com/world/story-1)")).toBe(
      "https://www.reuters.com/world/story-1",
    );
  });

  it("reads URLs out of citation HTML and decodes entities", () => {
    expect(
      extractSourceUrl('<p>Lee 20 <a href="#">https://example.com/a?x=1&amp;y=2</a></p>'),
    ).toBe("https://example.com/a?x=1&y=2");
  });

  it("returns null when the citation has no URL", () => {
    expect(extractSourceUrl("Smith 23, Brookings, 2023")).toBeNull();
    expect(extractSourceUrl("")).toBeNull();
    expect(extractSourceUrl(null)).toBeNull();
  });
});

describe("parseCardRecord", () => {
  it("parses author, year, URL, and highlighted and underlined runs", () => {
    const parsed = parseCardRecord({
      cite: "Smith 23",
      fullcite: "Smith 23 [Jane Smith, Professor, https://example.com/story]",
      markup:
        "<p>Automation <u><mark>will displace</mark> millions</u> of workers, <mark>by 2030</mark> &amp; beyond.</p>",
    });
    expect(parsed).toMatchObject({
      sourceUrl: "https://example.com/story",
      author: "Smith",
      year: 2023,
      quotes: ["will displace", "by 2030"],
      underlined: ["will displace millions"],
    });
  });

  it("falls back to the spoken column when the markup has no highlighting", () => {
    expect(parseCardRecord({ markup: "<p>plain</p>", spoken: "  what was read  " }).quotes).toEqual([
      "what was read",
    ]);
  });

  it("returns empty fields for an empty record instead of throwing", () => {
    expect(parseCardRecord({})).toEqual({
      sourceUrl: null,
      author: null,
      authorType: null,
      year: null,
      quotes: [],
      underlined: [],
    });
  });
});
