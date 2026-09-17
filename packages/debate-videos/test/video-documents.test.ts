/**
 * @fileoverview The long-form document parser behind the watch page's tabs.
 *
 * A round's transcript is eight or nine speeches and tens of thousands of
 * words, and the only thing that makes it navigable is its headings. So what
 * is pinned here is the heading contract:
 *   - `##` starts a speech, and text before the first one is not lost;
 *   - a timecode in brackets, parentheses or after a dash is understood, and
 *     is what lets a heading seek the video;
 *   - something that merely looks like a timecode is not mistaken for one;
 *   - word counts ignore the markup, so a 12-speech transcript is not
 *     credited with 12 extra words.
 */

import { describe, expect, it } from "vitest";
import {
  countWords,
  formatTimecode,
  isVideoDocumentKind,
  orderDocuments,
  parseDocumentSections,
  parseTimecode,
  toParagraphs,
  type VideoDocument,
} from "../src/lib/video-documents";

describe("countWords", () => {
  it("counts heading text but not the markers around it", () => {
    // The `##` is markup, so it is not a word; "1AC" is the speech's name and
    // is. Counting the markers would credit a 12-speech round with 12 words
    // it does not have.
    expect(countWords("## 1AC\n\nthree words here")).toBe(4);
    expect(countWords("1AC\n\nthree words here")).toBe(4);
  });

  it("is zero for an empty document", () => {
    expect(countWords("")).toBe(0);
    expect(countWords("   \n  ")).toBe(0);
  });
});

describe("parseTimecode", () => {
  it("reads m:ss and h:mm:ss", () => {
    expect(parseTimecode("2:15")).toBe(135);
    expect(parseTimecode("1:02:03")).toBe(3723);
  });

  it("rejects text that is not a timecode", () => {
    expect(parseTimecode("2NR")).toBeNull();
    expect(parseTimecode("")).toBeNull();
    // Minutes and seconds cannot exceed 59.
    expect(parseTimecode("1:75")).toBeNull();
  });

  it("round-trips through the formatter", () => {
    expect(formatTimecode(135)).toBe("2:15");
    expect(formatTimecode(3723)).toBe("1:02:03");
    expect(parseTimecode(formatTimecode(3723))).toBe(3723);
  });
});

describe("parseDocumentSections", () => {
  it("splits a round into its speeches", () => {
    const sections = parseDocumentSections(
      ["## 1AC — Aff (0:00)", "", "First speech.", "", "## 1NC — Neg (9:30)", "", "Second speech."].join(
        "\n",
      ),
    );

    expect(sections).toHaveLength(2);
    expect(sections[0]).toMatchObject({
      heading: "1AC — Aff",
      startSeconds: 0,
      body: "First speech.",
      wordCount: 2,
    });
    expect(sections[1]).toMatchObject({ heading: "1NC — Neg", startSeconds: 570 });
  });

  it("understands all three ways people write a timecode", () => {
    const sections = parseDocumentSections(
      ["## 1AC [2:15]", "a", "## 1NC (3:30)", "b", "## 2AC — 4:45", "c"].join("\n"),
    );
    expect(sections.map((section) => section.startSeconds)).toEqual([135, 210, 285]);
    expect(sections.map((section) => section.heading)).toEqual(["1AC", "1NC", "2AC"]);
  });

  it("leaves a heading that only looks numeric alone", () => {
    const [section] = parseDocumentSections("## Round 3\n\nbody");
    expect(section.heading).toBe("Round 3");
    expect(section.startSeconds).toBeNull();
  });

  it("keeps the text before the first heading", () => {
    // A document that opens with a preamble must not lose it.
    const sections = parseDocumentSections("An introduction.\n\n## 1AC\n\nThe speech.");
    expect(sections).toHaveLength(2);
    expect(sections[0]).toMatchObject({ heading: "", body: "An introduction." });
  });

  it("keeps a named speech that has not been typed up yet", () => {
    // The heading is itself information: that speech exists and is missing.
    const sections = parseDocumentSections("## 1AC\n\nThe speech.\n\n## 2AC\n");
    expect(sections).toHaveLength(2);
    expect(sections[1]).toMatchObject({ heading: "2AC", body: "", wordCount: 0 });
  });

  it("is empty for an empty document", () => {
    expect(parseDocumentSections("")).toEqual([]);
    expect(parseDocumentSections("   ")).toEqual([]);
  });

  it("handles a transcript of many thousands of words", () => {
    const speech = "word ".repeat(1200).trim();
    const body = Array.from({ length: 9 }, (_, i) => `## Speech ${i + 1} (${i}:00)\n\n${speech}`).join(
      "\n\n",
    );

    const sections = parseDocumentSections(body);
    expect(sections).toHaveLength(9);
    expect(sections.reduce((total, section) => total + section.wordCount, 0)).toBe(10_800);
  });
});

describe("toParagraphs", () => {
  it("splits on blank lines and drops the empties", () => {
    expect(toParagraphs("one\n\n\ntwo\n\n")).toEqual(["one", "two"]);
  });
});

describe("orderDocuments", () => {
  const document = (kind: VideoDocument["kind"], body: string): VideoDocument => ({
    videoId: "dQw4w9WgXcQ",
    kind,
    body,
  });

  it("puts them in tab order regardless of how they arrive", () => {
    const ordered = orderDocuments([
      document("analysis", "c"),
      document("summary", "b"),
      document("transcript", "a"),
    ]);
    expect(ordered.map((entry) => entry.kind)).toEqual(["transcript", "summary", "analysis"]);
  });

  it("drops empty documents rather than showing an empty tab", () => {
    const ordered = orderDocuments([document("transcript", "   "), document("summary", "b")]);
    expect(ordered.map((entry) => entry.kind)).toEqual(["summary"]);
  });
});

describe("isVideoDocumentKind", () => {
  it("accepts the three kinds and nothing else", () => {
    expect(isVideoDocumentKind("transcript")).toBe(true);
    expect(isVideoDocumentKind("summary")).toBe(true);
    expect(isVideoDocumentKind("analysis")).toBe(true);
    expect(isVideoDocumentKind("notes")).toBe(false);
    expect(isVideoDocumentKind(null)).toBe(false);
  });
});
