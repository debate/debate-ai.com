import { describe, expect, it } from "vitest";
import { MAX_HEADING_LENGTH, outlineFromHtml, sanitizeOutline } from "../src/outline";

describe("outlineFromHtml", () => {
  it("keeps pocket, hat, block and tag headings and drops the cards", () => {
    const html = `
      <h1>Aff</h1>
      <h2 class="hat">Case</h2>
      <h3>Contention 1 &amp; <em>Harms</em></h3>
      <h4>Warming causes extinction</h4>
      <p class="cite">Smith 24, professor</p>
      <p>Card body that a buyer pays for <mark>highlighted</mark></p>
      <h5>not part of the outline</h5>`;
    expect(outlineFromHtml(html)).toEqual([
      { level: 1, text: "Aff" },
      { level: 2, text: "Case" },
      { level: 3, text: "Contention 1 & Harms" },
      { level: 4, text: "Warming causes extinction" },
    ]);
  });

  it("skips empty headings and decodes numeric entities", () => {
    expect(outlineFromHtml("<h1> </h1><h2>A&#39;s &#x2014; B</h2>")).toEqual([{ level: 2, text: "A's — B" }]);
  });

  it("caps a heading's length", () => {
    const [entry] = outlineFromHtml(`<h4>${"x".repeat(500)}</h4>`);
    expect(entry.text).toHaveLength(MAX_HEADING_LENGTH);
  });
});

describe("sanitizeOutline", () => {
  it("rejects anything but an array", () => {
    expect(sanitizeOutline("nope")).toBeNull();
    expect(sanitizeOutline({ level: 1, text: "x" })).toBeNull();
  });

  it("drops malformed entries and trims the rest", () => {
    expect(
      sanitizeOutline([{ level: 1, text: "  Pocket  " }, { level: 5, text: "deep" }, { level: 2 }, null, { level: 4, text: "Tag" }]),
    ).toEqual([
      { level: 1, text: "Pocket" },
      { level: 4, text: "Tag" },
    ]);
  });
});
