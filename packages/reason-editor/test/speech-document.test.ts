import { describe, expect, it } from "vitest";
import {
  appendSpeechDocumentBlock,
  buildSpeechDocumentBlock,
  buildSpeechDocumentText,
  createSpeechDocument,
  removeSpeechDocumentBlock,
} from "../src/engine/speech-document";
import type { SpeechDocument } from "../src/engine/speech-document";

describe("createSpeechDocument", () => {
  it("creates an empty document with the given title", () => {
    expect(createSpeechDocument("doc-1", "1AC Solvency")).toEqual({
      id: "doc-1",
      title: "1AC Solvency",
      blocks: [],
    });
  });

  it("falls back to a default title when blank", () => {
    expect(createSpeechDocument("doc-1", "   ").title).toBe("Untitled speech");
  });

  it("trims the title", () => {
    expect(createSpeechDocument("doc-1", "  1AC  ").title).toBe("1AC");
  });
});

describe("buildSpeechDocumentBlock", () => {
  it("builds a trimmed block", () => {
    expect(buildSpeechDocumentBlock("block-1", "  Warming causes extinction.  ", 1000)).toEqual({
      id: "block-1",
      text: "Warming causes extinction.",
      addedAt: 1000,
    });
  });

  it("includes a trimmed sourceLabel when given", () => {
    expect(buildSpeechDocumentBlock("block-1", "Text", 1000, "  Smith 24  ")).toEqual({
      id: "block-1",
      text: "Text",
      addedAt: 1000,
      sourceLabel: "Smith 24",
    });
  });

  it("omits sourceLabel when blank", () => {
    expect(buildSpeechDocumentBlock("block-1", "Text", 1000, "   ")).toEqual({
      id: "block-1",
      text: "Text",
      addedAt: 1000,
    });
  });

  it("returns null for blank text", () => {
    expect(buildSpeechDocumentBlock("block-1", "", 1000)).toBeNull();
    expect(buildSpeechDocumentBlock("block-1", "   ", 1000)).toBeNull();
  });
});

describe("appendSpeechDocumentBlock", () => {
  it("appends without mutating the original document", () => {
    const doc = createSpeechDocument("doc-1", "1AC");
    const block = buildSpeechDocumentBlock("block-1", "Text", 1000)!;
    const updated = appendSpeechDocumentBlock(doc, block);

    expect(updated.blocks).toEqual([block]);
    expect(doc.blocks).toEqual([]);
    expect(updated).not.toBe(doc);
  });

  it("preserves existing block order and appends at the end", () => {
    const doc: SpeechDocument = {
      id: "doc-1",
      title: "1AC",
      blocks: [buildSpeechDocumentBlock("block-1", "First", 1000)!],
    };
    const updated = appendSpeechDocumentBlock(doc, buildSpeechDocumentBlock("block-2", "Second", 2000)!);
    expect(updated.blocks.map((b) => b.id)).toEqual(["block-1", "block-2"]);
  });
});

describe("removeSpeechDocumentBlock", () => {
  const doc: SpeechDocument = {
    id: "doc-1",
    title: "1AC",
    blocks: [
      buildSpeechDocumentBlock("block-1", "First", 1000)!,
      buildSpeechDocumentBlock("block-2", "Second", 2000)!,
    ],
  };

  it("removes a block by id", () => {
    const updated = removeSpeechDocumentBlock(doc, "block-1");
    expect(updated.blocks.map((b) => b.id)).toEqual(["block-2"]);
  });

  it("is a no-op (by value) when the block id isn't present", () => {
    const updated = removeSpeechDocumentBlock(doc, "missing");
    expect(updated.blocks).toEqual(doc.blocks);
  });
});

describe("buildSpeechDocumentText", () => {
  it("joins blocks with a blank line between them", () => {
    const doc: SpeechDocument = {
      id: "doc-1",
      title: "1AC",
      blocks: [
        buildSpeechDocumentBlock("block-1", "First point.", 1000)!,
        buildSpeechDocumentBlock("block-2", "Second point.", 2000)!,
      ],
    };
    expect(buildSpeechDocumentText(doc)).toBe("First point.\n\nSecond point.");
  });

  it("prefixes a block with its bracketed source label when present", () => {
    const doc: SpeechDocument = {
      id: "doc-1",
      title: "1AC",
      blocks: [buildSpeechDocumentBlock("block-1", "Warming is real.", 1000, "Smith 24")!],
    };
    expect(buildSpeechDocumentText(doc)).toBe("[Smith 24] Warming is real.");
  });

  it("returns an empty string for a document with no blocks", () => {
    expect(buildSpeechDocumentText(createSpeechDocument("doc-1", "1AC"))).toBe("");
  });
});
