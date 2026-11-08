/**
 * @fileoverview The size stats kept for every stored file (quotes, blocks,
 * pages, characters) and the hover text the docs sidebar shows them in.
 */
import { describe, expect, it } from "vitest";
import { cmirToBase64, docxToCmir, schema, serializeNative, toDocx } from "@debate-ai/editor/engine";
import { readDocxAuthor } from "@debate-ai/card-parser";
import JSZip from "jszip";

import {
  CHARS_PER_PAGE,
  computeStoredFileStats,
  estimatePages,
  formatFileHoverText,
  statsFromDocJson,
  statsFromHtml,
  yearOf,
} from "../../../src/lib/file-stats/file-stats";

const textBlock = (name: string, value: string) => schema.nodes[name]!.create(null, value ? [schema.text(value)] : []);

const card = (tag: string, body: string) =>
  schema.nodes["card"]!.create(null, [textBlock("tag", tag), textBlock("cite_paragraph", "Nguyen 25"), textBlock("card_body", body)]);

/** Two blocks holding three cards. */
function sampleDoc() {
  return schema.nodes["doc"]!.create(null, [
    textBlock("block", "Deterrence"),
    card("Deterrence fails", "Escalation is uncontrollable."),
    card("Arms races", "Spending spirals."),
    textBlock("block", "Economy"),
    card("Recession", "Growth stalls."),
  ]);
}

describe("estimatePages", () => {
  it("is zero for no text and at least one page for any text", () => {
    expect(estimatePages(0)).toBe(0);
    expect(estimatePages(1)).toBe(1);
    expect(estimatePages(CHARS_PER_PAGE)).toBe(1);
    expect(estimatePages(CHARS_PER_PAGE + 1)).toBe(2);
  });
});

describe("statsFromDocJson", () => {
  it("counts cards as quotes, blocks, and every text character", () => {
    const doc = sampleDoc();
    const stats = statsFromDocJson(doc.toJSON());
    expect(stats.quoteCount).toBe(3);
    expect(stats.blockCount).toBe(2);
    expect(stats.charCount).toBe(doc.textContent.length);
    expect(stats.pageCount).toBe(1);
  });

  it("never throws on junk", () => {
    expect(statsFromDocJson(null)).toEqual({ quoteCount: 0, blockCount: 0, pageCount: 0, charCount: 0 });
    expect(statsFromDocJson({ content: "nope" }).charCount).toBe(0);
  });
});

describe("statsFromHtml", () => {
  it("reads Debate Editor HTML by class, not mistaking card_body for a card", () => {
    const html =
      '<h3 class="pmd-block">A</h3><div class="pmd-card"><h4 class="pmd-tag">T</h4><p class="pmd-card-body">x &amp; y</p></div>';
    expect(statsFromHtml(html)).toEqual({ quoteCount: 1, blockCount: 1, pageCount: 1, charCount: "ATx & y".length });
  });

  it("falls back to h4 tags and h3 headings for older HTML", () => {
    expect(statsFromHtml("<h3>Block</h3><h4>Tag one</h4><p>a</p><h4>Tag two</h4>")).toMatchObject({ quoteCount: 2, blockCount: 1 });
  });
});

describe("computeStoredFileStats", () => {
  it("decodes a stored gzipped .cmir", async () => {
    const doc = sampleDoc();
    const content = cmirToBase64(serializeNative(doc));
    const stats = await computeStoredFileStats({ content, format: "cmir" });
    expect(stats).toMatchObject({ quoteCount: 3, blockCount: 2, charCount: doc.textContent.length });
  });

  it("counts a .cmir imported from Word the same way", async () => {
    const bytes = await toDocx(sampleDoc());
    const { bytes: cmir } = await docxToCmir(bytes);
    const stats = await computeStoredFileStats({ content: cmirToBase64(cmir), format: "cmir" });
    expect(stats.quoteCount).toBe(3);
    expect(stats.blockCount).toBe(2);
  });

  it("treats empty and undecodable content as empty", async () => {
    expect((await computeStoredFileStats({ content: "", format: "cmir" })).charCount).toBe(0);
    expect((await computeStoredFileStats({ content: "H4sIAAAA", format: "cmir" })).charCount).toBe(0);
  });

  it("reads HTML rows as HTML", async () => {
    expect((await computeStoredFileStats({ content: "<p>Hello</p>", format: "html" })).charCount).toBe(5);
  });
});

describe("formatFileHoverText", () => {
  it("lists modified date, author, year and every stat", () => {
    const text = formatFileHoverText({
      title: "Aff file",
      updatedAt: "2026-11-08T12:00:00.000Z",
      author: "Alexa",
      year: 2027,
      quoteCount: 12,
      blockCount: 3,
      pageCount: 4,
      charCount: 11234,
    });
    expect(text.split("\n")).toEqual([
      "Aff file",
      "Last modified: Nov 8, 2026",
      "Author: Alexa",
      "Year: 2027",
      "Pages: 4",
      "Quotes: 12",
      "Blocks: 3",
      "Characters: 11,234",
    ]);
  });

  it("says when stats are not counted yet and skips unknowns", () => {
    expect(formatFileHoverText({ title: "Old", charCount: null })).toBe("Old\nPages, quotes, blocks and characters: not counted yet");
  });
});

describe("yearOf", () => {
  it("handles ISO strings, epoch ms and epoch seconds", () => {
    expect(yearOf("2025-03-01T00:00:00Z")).toBe(2025);
    expect(yearOf(Date.UTC(2024, 5, 1))).toBe(2024);
    expect(yearOf(Date.UTC(2024, 5, 1) / 1000)).toBe(2024);
    expect(yearOf(null)).toBeNull();
  });
});

describe("readDocxAuthor", () => {
  async function docxWithCore(core: string | null) {
    const zip = await JSZip.loadAsync(await toDocx(sampleDoc()));
    if (core === null) zip.remove("docProps/core.xml");
    else zip.file("docProps/core.xml", core);
    return zip.generateAsync({ type: "uint8array" });
  }
  const core = (creator: string, last = "") =>
    `<?xml version="1.0"?><cp:coreProperties xmlns:cp="x" xmlns:dc="y"><dc:creator>${creator}</dc:creator><cp:lastModifiedBy>${last}</cp:lastModifiedBy></cp:coreProperties>`;

  it("reads dc:creator", async () => {
    expect(await readDocxAuthor(await docxWithCore(core("Jane &amp; Co")))).toBe("Jane & Co");
  });
  it("skips placeholder names and falls back to lastModifiedBy", async () => {
    expect(await readDocxAuthor(await docxWithCore(core("User", "Sam Lee")))).toBe("Sam Lee");
  });
  it("is null with no core properties or unreadable bytes", async () => {
    expect(await readDocxAuthor(await docxWithCore(null))).toBeNull();
    expect(await readDocxAuthor(new Uint8Array([1, 2, 3]))).toBeNull();
  });
});
