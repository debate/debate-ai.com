/**
 * @fileoverview The schema → OOXML exporter.
 *
 * Its contract is the round-trip one in ARCHITECTURE.md §3: a schema-typed
 * block becomes its canonical Verbatim style reference, a direct-formatting
 * mark becomes run properties, and a heading keeps its stable id as a
 * bookmark pair bracketing the paragraph. That last one is what lets a link
 * into a card survive a Word round trip, so it is checked by name.
 *
 * The optional parts each carry a null-when-absent contract, because the zip
 * writer skips a part it is handed null for — emitting an empty numbering or
 * comments part instead would put a part in the package that nothing declares.
 */

import { describe, expect, it } from "vitest";
import { Fragment, type Node as PMNode } from "prosemirror-model";

import { exportDoc } from "../src/export/exporter";
import { MARK_TO_RSTYLE, NODE_TO_PSTYLE } from "../src/ooxml/styles";
import { schema } from "../src/schema/index";

const block = (name: string, children: PMNode[]) =>
  schema.nodes[name]!.create(null, Fragment.fromArray(children));

const textBlock = (name: string, value: string, attrs: Record<string, unknown> | null = null) =>
  schema.nodes[name]!.create(attrs, value ? schema.text(value) : Fragment.empty);

const doc = (...blocks: PMNode[]) => schema.nodes["doc"]!.create(null, Fragment.fromArray(blocks));

const marked = (value: string, marks: string[]) =>
  schema.text(
    value,
    marks.map((m) => schema.marks[m]!.create(m === "link" ? { href: "https://example.com" } : null)),
  );

const para = (children: PMNode[]) =>
  schema.nodes["paragraph"]!.create(null, Fragment.fromArray(children));

const xml = (d: PMNode) => exportDoc(d).documentXml;

describe("exportDoc document shape", () => {
  it("emits a well-formed document part around the body", () => {
    const out = xml(doc(textBlock("paragraph", "hello")));
    expect(out.startsWith("<?xml")).toBe(true);
    expect(out).toContain("<w:document");
    expect(out).toContain("<w:body>");
    expect(out).toContain("</w:body>");
    expect(out).toContain("</w:document>");
  });

  it("declares the namespaces Word needs", () => {
    const out = xml(doc(textBlock("paragraph", "hello")));
    expect(out).toContain('xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"');
    expect(out).toContain("xmlns:r=");
  });

  it("emits a paragraph per block, carrying its text", () => {
    const out = xml(doc(textBlock("paragraph", "one"), textBlock("paragraph", "two")));
    expect(out.match(/<w:p[ >]/g)!.length).toBeGreaterThanOrEqual(2);
    expect(out).toContain("<w:t");
    expect(out).toContain("one");
    expect(out).toContain("two");
  });

  it("exports an empty document without failing", () => {
    expect(() => xml(doc(schema.nodes["paragraph"]!.create()))).not.toThrow();
  });
});

describe("block styles", () => {
  it("gives each heading node its canonical Verbatim style", () => {
    for (const [node, style] of Object.entries(NODE_TO_PSTYLE)) {
      if (style === null) continue;
      const inner =
        node === "tag"
          ? doc(block("card", [textBlock("tag", "text")]))
          : node === "analytic"
            ? doc(block("analytic_unit", [textBlock("analytic", "text")]))
            : doc(textBlock(node, "text"));
      expect(xml(inner)).toContain(`<w:pStyle w:val="${style}"/>`);
    }
  });

  it("leaves a body paragraph on Normal, with no style reference at all", () => {
    const out = xml(doc(textBlock("paragraph", "body text")));
    expect(out).not.toContain("<w:pStyle");
  });

  it("leaves a card body on Normal too", () => {
    const out = xml(doc(block("card", [textBlock("tag", "T"), textBlock("card_body", "body")])));
    // The tag's Heading4 is the only style reference the card emits.
    expect(out.match(/<w:pStyle/g)).toHaveLength(1);
  });

  it("emits a card's blocks in order", () => {
    const out = xml(
      doc(
        block("card", [
          textBlock("tag", "TAGTEXT"),
          textBlock("cite_paragraph", "CITETEXT"),
          textBlock("card_body", "BODYTEXT"),
        ]),
      ),
    );
    expect(out.indexOf("TAGTEXT")).toBeLessThan(out.indexOf("CITETEXT"));
    expect(out.indexOf("CITETEXT")).toBeLessThan(out.indexOf("BODYTEXT"));
  });
});

describe("run formatting", () => {
  it("gives each named-style mark its canonical run style", () => {
    for (const [mark, style] of Object.entries(MARK_TO_RSTYLE)) {
      if (style === null) continue;
      const out = xml(doc(para([marked("text", [mark])])));
      expect(out).toContain(`<w:rStyle w:val="${style}"/>`);
    }
  });

  it("emits the direct toggles as run properties", () => {
    expect(xml(doc(para([marked("x", ["bold"])])))).toContain("<w:b/>");
    expect(xml(doc(para([marked("x", ["italic"])])))).toContain("<w:i/>");
    expect(xml(doc(para([marked("x", ["strikethrough"])])))).toContain("<w:strike/>");
  });

  it("emits a highlight with its colour", () => {
    const mark = schema.marks["highlight"]!.create({ color: "yellow" });
    const out = xml(doc(para([schema.text("x", [mark])])));
    expect(out).toContain("<w:highlight");
    expect(out).toContain("yellow");
  });

  it("emits an explicit run size in half-points", () => {
    const mark = schema.marks["font_size"]!.create({ halfPoints: 24 });
    const out = xml(doc(para([schema.text("x", [mark])])));
    expect(out).toContain('<w:sz w:val="24"/>');
  });

  it("carries several marks on one run", () => {
    const out = xml(doc(para([marked("x", ["bold", "italic"])])));
    expect(out).toContain("<w:b/>");
    expect(out).toContain("<w:i/>");
  });

  it("keeps the runs of one paragraph apart", () => {
    const out = xml(doc(para([schema.text("plain "), marked("bold", ["bold"])])));
    expect(out.match(/<w:r>/g)!.length).toBeGreaterThanOrEqual(2);
  });

  it("emits no run properties for unformatted text", () => {
    expect(xml(doc(para([schema.text("plain")])))).not.toContain("<w:rPr>");
  });
});

describe("text escaping", () => {
  it("escapes the characters XML reserves", () => {
    const out = xml(doc(textBlock("paragraph", "a < b & c > d")));
    expect(out).toContain("&lt;");
    expect(out).toContain("&amp;");
    expect(out).not.toContain("a < b");
  });

  it("escapes a quote a debater typed", () => {
    expect(() => xml(doc(textBlock("paragraph", 'the "best" case')))).not.toThrow();
    expect(xml(doc(textBlock("paragraph", 'the "best" case')))).toContain("best");
  });

  it("preserves leading and trailing space, which Word drops without the hint", () => {
    const out = xml(doc(textBlock("paragraph", "  spaced  ")));
    expect(out).toContain('xml:space="preserve"');
  });

  it("carries text outside the ASCII range through", () => {
    expect(xml(doc(textBlock("paragraph", "中文 — café")))).toContain("中文");
  });
});

describe("heading bookmarks", () => {
  const withId = (id: string) =>
    doc(block("card", [textBlock("tag", "Warming is real", { id })]));

  it("brackets a heading with a bookmark named for its stable id", () => {
    const out = xml(withId("abc-123"));
    expect(out).toContain("pmd-heading-abc-123");
    expect(out).toContain("<w:bookmarkStart");
    expect(out).toContain("<w:bookmarkEnd");
  });

  it("pairs every bookmark start with an end", () => {
    const out = xml(withId("abc-123"));
    expect(out.match(/<w:bookmarkStart/g)!.length).toBe(out.match(/<w:bookmarkEnd/g)!.length);
  });

  it("gives each heading its own bookmark", () => {
    const out = xml(
      doc(
        block("card", [textBlock("tag", "one", { id: "id-1" })]),
        block("card", [textBlock("tag", "two", { id: "id-2" })]),
      ),
    );
    expect(out).toContain("pmd-heading-id-1");
    expect(out).toContain("pmd-heading-id-2");
  });

  it("writes no bookmark for a heading carrying no id", () => {
    const out = xml(doc(block("card", [textBlock("tag", "no id")])));
    expect(out).not.toContain("pmd-heading-");
  });
});

describe("hyperlinks", () => {
  const linked = doc(para([marked("Read it", ["link"])]));

  it("emits the link as a hyperlink referring to a relationship", () => {
    const out = xml(linked);
    expect(out).toContain("<w:hyperlink");
    expect(out).toContain("r:id=");
  });

  it("collects the relationship into the rels part", () => {
    const rels = exportDoc(linked).relsXml;
    expect(rels).toContain("https://example.com");
    expect(rels).toContain("hyperlink");
    expect(rels).toContain('TargetMode="External"');
  });

  it("writes a rels part even for a document with no links", () => {
    const rels = exportDoc(doc(textBlock("paragraph", "plain"))).relsXml;
    expect(rels).toContain("<Relationships");
  });

  it("gives two links two relationship ids", () => {
    const two = doc(
      para([marked("one", ["link"])]),
      para([
        schema.text("two", [schema.marks["link"]!.create({ href: "https://other.example" })]),
      ]),
    );
    const rels = exportDoc(two).relsXml;
    expect(rels).toContain("https://example.com");
    expect(rels).toContain("https://other.example");
  });
});

describe("the optional parts", () => {
  const plain = doc(textBlock("paragraph", "plain"));

  it("emits no numbering part for a document with no numbered cards", () => {
    expect(exportDoc(plain).numberingXml).toBeNull();
  });

  it("emits no comments parts when no threads were passed in", () => {
    const out = exportDoc(plain);
    expect(out.commentsXml).toBeNull();
    expect(out.commentsExtendedXml).toBeNull();
  });

  it("emits no comments parts for an empty thread list either", () => {
    const out = exportDoc(plain, { threads: [] });
    expect(out.commentsXml).toBeNull();
  });

  it("omits the comment brackets when no threads were passed, whatever the doc carries", () => {
    const commented = doc(
      para([schema.text("x", [schema.marks["comment_range"]!.create({ id: "c1" })])]),
    );
    expect(exportDoc(commented).documentXml).not.toContain("commentRangeStart");
  });

  it("emits no footnote or endnote parts for a document with neither", () => {
    const out = exportDoc(plain);
    expect(out.footnotesXml).toBeNull();
    expect(out.footnotesRelsXml).toBeNull();
    expect(out.endnotesXml).toBeNull();
    expect(out.endnotesRelsXml).toBeNull();
  });

  it("carries no media parts for a document with no images", () => {
    expect(exportDoc(plain).mediaParts).toEqual([]);
  });

  it("ignores the docId, which packaging rather than this pass writes", () => {
    expect(exportDoc(plain, { docId: "abc" }).documentXml).toBe(exportDoc(plain).documentXml);
  });

  it("ignores the default font, which packaging applies", () => {
    expect(exportDoc(plain, { defaultFont: "Cambria" }).documentXml).toBe(
      exportDoc(plain).documentXml,
    );
  });
});

describe("tables", () => {
  it("emits a table with its rows and cells", () => {
    const cell = (value: string) =>
      schema.nodes["table_cell"]!.create(
        null,
        Fragment.from(schema.nodes["paragraph"]!.create(null, schema.text(value))),
      );
    const table = block("table", [block("table_row", [cell("a"), cell("b")])]);
    const out = xml(doc(block("card", [textBlock("tag", "T"), table])));
    expect(out).toContain("<w:tbl>");
    expect(out).toContain("<w:tr>");
    expect(out).toContain("<w:tc>");
    expect(out).toContain("a");
    expect(out).toContain("b");
  });
});

describe("determinism", () => {
  it("exports the same document to the same bytes twice", () => {
    const d = doc(
      block("card", [textBlock("tag", "T", { id: "id-1" }), textBlock("card_body", "body")]),
      para([marked("linked", ["link"])]),
    );
    expect(exportDoc(d).documentXml).toBe(exportDoc(d).documentXml);
    expect(exportDoc(d).relsXml).toBe(exportDoc(d).relsXml);
  });
});
