/**
 * @fileoverview The style vocabulary the importer and exporter meet over.
 *
 * The two maps have to stay each other's inverse where they overlap, or a
 * file round-tripped through CardMirror comes back typed differently than it
 * went in. The legacy rStyle aliases are the other half of that: a 2013-era
 * 1AC carries `StyleBoldUnderline` on every underlined run, and a map that
 * knew only the modern id would drop all 1,760 of them silently on import.
 */

import { describe, expect, it } from "vitest";

import {
  CANONICAL_STYLES_XML,
  MARK_TO_RSTYLE,
  NODE_TO_PSTYLE,
  PSTYLE_TO_NODE,
  RSTYLE_TO_MARK,
  canonicalStylesXml,
  fallbackNodeType,
  type StyleInfo,
} from "../src/ooxml/styles";
import { schema } from "../src/schema/index";

const info = (over: Partial<StyleInfo> = {}): StyleInfo => ({
  id: "Custom",
  name: "Custom",
  type: "paragraph",
  ...over,
});

describe("canonicalStylesXml", () => {
  it("is a well-formed styles part", () => {
    const xml = canonicalStylesXml();
    expect(xml.startsWith("<?xml")).toBe(true);
    expect(xml).toContain("<w:styles");
    expect(xml).toContain("</w:styles>");
  });

  it("declares the default paragraph style Word expects", () => {
    expect(canonicalStylesXml()).toContain('w:styleId="Normal"');
  });

  it("carries every canonical paragraph style the exporter references", () => {
    const xml = canonicalStylesXml();
    for (const style of Object.values(NODE_TO_PSTYLE)) {
      if (style) expect(xml).toContain(`w:styleId="${style}"`);
    }
  });

  it("carries every canonical run style the exporter references", () => {
    const xml = canonicalStylesXml();
    for (const style of Object.values(MARK_TO_RSTYLE)) {
      if (style) expect(xml).toContain(`w:styleId="${style}"`);
    }
  });

  it("defaults its literal font to the ecosystem baseline", () => {
    expect(canonicalStylesXml()).toContain('w:ascii="Calibri"');
  });

  it("takes the caller's own display font", () => {
    const xml = canonicalStylesXml("Cambria");
    expect(xml).toContain('w:ascii="Cambria"');
    expect(xml).toContain('w:hAnsi="Cambria"');
  });

  it("escapes a font name carrying a character XML reserves", () => {
    const xml = canonicalStylesXml('Fo"nt & Co');
    expect(xml).toContain("&amp;");
    expect(xml).not.toContain('w:ascii="Fo"nt');
  });

  it("keeps the theme attributes beside the literal font, which Word reads instead", () => {
    expect(canonicalStylesXml("Cambria")).toContain("Theme");
  });

  it("caches the default part as a constant", () => {
    expect(CANONICAL_STYLES_XML).toBe(canonicalStylesXml());
  });
});

describe("the node and style maps", () => {
  it("names a style for every heading node and none for the body ones", () => {
    expect(NODE_TO_PSTYLE["tag"]).toBe("Heading4");
    expect(NODE_TO_PSTYLE["pocket"]).toBe("Heading1");
    expect(NODE_TO_PSTYLE["card_body"]).toBeNull();
    expect(NODE_TO_PSTYLE["paragraph"]).toBeNull();
  });

  it("gives each styled node a distinct style", () => {
    const styles = Object.values(NODE_TO_PSTYLE).filter(Boolean);
    expect(new Set(styles).size).toBe(styles.length);
  });

  it("inverts back to the node it came from", () => {
    for (const [node, style] of Object.entries(NODE_TO_PSTYLE)) {
      if (style) expect(PSTYLE_TO_NODE[style]).toBe(node);
    }
  });

  it("names only node types the schema defines", () => {
    for (const node of Object.keys(NODE_TO_PSTYLE)) {
      expect(schema.nodes[node]).toBeDefined();
    }
    for (const node of Object.values(PSTYLE_TO_NODE)) {
      expect(schema.nodes[node]).toBeDefined();
    }
  });

  it("names only marks the schema defines", () => {
    for (const mark of Object.keys(MARK_TO_RSTYLE)) {
      expect(schema.marks[mark]).toBeDefined();
    }
    for (const mark of Object.values(RSTYLE_TO_MARK)) {
      expect(schema.marks[mark]).toBeDefined();
    }
  });

  it("round-trips every named-style mark through its run style", () => {
    for (const [mark, style] of Object.entries(MARK_TO_RSTYLE)) {
      if (style) expect(RSTYLE_TO_MARK[style]).toBe(mark);
    }
  });

  it("reads the legacy underline style older files carry", () => {
    expect(RSTYLE_TO_MARK["StyleBoldUnderline"]).toBe("underline_mark");
    expect(RSTYLE_TO_MARK["Underline"]).toBe("underline_mark");
  });

  it("reads the legacy cite styles too, including the renamed alias", () => {
    expect(RSTYLE_TO_MARK["StyleStyleBold12pt"]).toBe("cite_mark");
    expect(RSTYLE_TO_MARK["Cite"]).toBe("cite_mark");
  });

  it("normalizes every legacy alias back to one modern id on export", () => {
    // Several ids read as one mark; that mark writes back as exactly one id.
    const legacy = ["StyleBoldUnderline", "Underline", "StyleUnderline"];
    const marks = new Set(legacy.map((id) => RSTYLE_TO_MARK[id]));
    expect(marks.size).toBe(1);
    expect(MARK_TO_RSTYLE[[...marks][0]!]).toBe("StyleUnderline");
  });

  it("does not read a style it has no rule for", () => {
    expect(RSTYLE_TO_MARK["SomeOtherStyle"]).toBeUndefined();
    expect(PSTYLE_TO_NODE["SomeOtherStyle"]).toBeUndefined();
  });
});

describe("fallbackNodeType", () => {
  it("recognises the explicit analytic style by name", () => {
    expect(fallbackNodeType(info({ name: "Analytic Real" }))).toBe("analytic");
  });

  it("recognises it by style id", () => {
    expect(fallbackNodeType(info({ id: "AnalyticReal", name: null }))).toBe("analytic");
  });

  it("compares a display name and its space-stripped id alike", () => {
    expect(fallbackNodeType(info({ name: "analytic  real" }))).toBe("analytic");
    expect(fallbackNodeType(info({ name: "ANALYTICREAL" }))).toBe("analytic");
  });

  it("recognises the explicit style whatever its type", () => {
    expect(fallbackNodeType(info({ name: "Analytic Real", type: "character" }))).toBe("analytic");
  });

  it("recognises a paragraph style merely naming an analytic", () => {
    expect(fallbackNodeType(info({ name: "My Analytic Style" }))).toBe("analytic");
    expect(fallbackNodeType(info({ id: "TeamAnalytic", name: null }))).toBe("analytic");
  });

  it("does not read a character style that merely names one", () => {
    expect(fallbackNodeType(info({ name: "Analytic Char", type: "character" }))).toBeNull();
  });

  it("does not read an ordinary style", () => {
    expect(fallbackNodeType(info({ id: "BodyText", name: "Body Text" }))).toBeNull();
  });

  it("reads nothing for a style the file does not define", () => {
    expect(fallbackNodeType(undefined)).toBeNull();
  });

  it("falls back to the id when a style carries no name", () => {
    expect(fallbackNodeType(info({ id: "Analytic", name: null }))).toBe("analytic");
    expect(fallbackNodeType(info({ id: "BodyText", name: null }))).toBeNull();
  });
});
