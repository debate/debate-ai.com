/**
 * @fileoverview The OOXML shim the style cleaner reads a .docx through.
 *
 * Its contract is not "some reasonable API" but *python-docx 1.1.0's*
 * behaviour, because the cleaner was translated from `style_cleaner.py`
 * line for line. So the fidelity notes at the top of the module — the
 * tri-state toggles, the CT_OnOff parsing where an absent `val` means on,
 * BabelFish name translation, the never-null default styles, the integer
 * style types — are exactly what is pinned here. A shim that reads a
 * `<w:b/>` as "not bold" would leave every bold run in a cut document
 * un-cleaned, silently.
 */

import { describe, expect, it } from "vitest";

import { Docx } from "../src/ooxml/docx";
import { OoxmlDoc, W, getAttr } from "../src/ooxml/style-clean/ooxml-doc";

const XMLNS = `xmlns:w="${W}"`;

/** A document.xml whose body is the given paragraph XML. */
const documentXml = (body: string) =>
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document ${XMLNS}><w:body>${body}</w:body></w:document>`;

/** A styles.xml holding the given `<w:style>` elements. */
const stylesXml = (styles: string) =>
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles ${XMLNS}>${styles}</w:styles>`;

/** Load a doc from raw part XML, bypassing the zip round trip. */
async function load(body: string, styles = ""): Promise<OoxmlDoc> {
  const docx = Docx.empty();
  docx.writeText("word/document.xml", documentXml(body));
  docx.writeText("word/styles.xml", stylesXml(styles));
  return OoxmlDoc.fromDocx(docx);
}

const p = (inner: string) => `<w:p>${inner}</w:p>`;
const r = (inner: string, text = "text") => `<w:r>${inner}<w:t>${text}</w:t></w:r>`;
const rPr = (inner: string) => `<w:rPr>${inner}</w:rPr>`;

const STYLE_NORMAL =
  '<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style>';
const STYLE_DEFAULT_FONT =
  '<w:style w:type="character" w:default="1" w:styleId="DefaultParagraphFont"><w:name w:val="Default Paragraph Font"/></w:style>';

describe("OoxmlDoc.fromDocx", () => {
  it("reads the body paragraphs", async () => {
    const doc = await load(p(r("", "one")) + p(r("", "two")));
    expect(doc.paragraphs.map((x) => x.text)).toEqual(["one", "two"]);
  });

  it("reads no paragraphs from an empty body", async () => {
    expect((await load("")).paragraphs).toEqual([]);
  });

  it("refuses a package with no document part", async () => {
    const docx = Docx.empty();
    docx.writeText("word/styles.xml", stylesXml(""));
    // Overwrite the part with nothing by removing it through a fresh package.
    const bare = await Docx.load(await docx.toBuffer());
    bare.writeText("word/document.xml", "");
    await expect(
      OoxmlDoc.fromDocx({
        readText: async (path: string) => (path === "word/document.xml" ? null : stylesXml("")),
      } as never),
    ).rejects.toThrow(/document.xml missing/);
    expect(bare).toBeDefined();
  });

  it("refuses a package with no styles part", async () => {
    await expect(
      OoxmlDoc.fromDocx({
        readText: async (path: string) =>
          path === "word/document.xml" ? documentXml("") : null,
      } as never),
    ).rejects.toThrow(/styles.xml missing/);
  });
});

describe("Run bold, as python-docx reads it", () => {
  it("is null when the run carries no direct toggle", async () => {
    const doc = await load(p(r("")));
    expect(doc.paragraphs[0]!.runs[0]!.bold).toBeNull();
  });

  it("is true for a bare toggle, since an absent val means on", async () => {
    const doc = await load(p(r(rPr("<w:b/>"))));
    expect(doc.paragraphs[0]!.runs[0]!.bold).toBe(true);
  });

  it("is true for the on spellings", async () => {
    for (const val of ["1", "true", "on"]) {
      const doc = await load(p(r(rPr(`<w:b w:val="${val}"/>`))));
      expect(doc.paragraphs[0]!.runs[0]!.bold).toBe(true);
    }
  });

  it("is false for the off spellings, whatever their case", async () => {
    for (const val of ["0", "false", "off", "FALSE", "Off"]) {
      const doc = await load(p(r(rPr(`<w:b w:val="${val}"/>`))));
      expect(doc.paragraphs[0]!.runs[0]!.bold).toBe(false);
    }
  });
});

describe("Run underline, as python-docx reads its truthiness", () => {
  it("is null when the run carries no direct toggle", async () => {
    expect((await load(p(r("")))).paragraphs[0]!.runs[0]!.underline).toBeNull();
  });

  it("is true for any underline style other than none", async () => {
    for (const val of ["single", "double", "wave"]) {
      const doc = await load(p(r(rPr(`<w:u w:val="${val}"/>`))));
      expect(doc.paragraphs[0]!.runs[0]!.underline).toBe(true);
    }
  });

  it("is false only for an explicit none", async () => {
    const doc = await load(p(r(rPr('<w:u w:val="none"/>'))));
    expect(doc.paragraphs[0]!.runs[0]!.underline).toBe(false);
  });
});

describe("Run formatting resolved through its style", () => {
  const styles =
    STYLE_NORMAL +
    STYLE_DEFAULT_FONT +
    '<w:style w:type="character" w:styleId="BoldStyle"><w:name w:val="Bold Style"/><w:rPr><w:b/></w:rPr></w:style>' +
    '<w:style w:type="character" w:styleId="ULStyle"><w:name w:val="UL Style"/><w:rPr><w:u w:val="single"/></w:rPr></w:style>';

  it("falls back to the run's character style for bold", async () => {
    const doc = await load(p(r(rPr('<w:rStyle w:val="BoldStyle"/>'))), styles);
    const run = doc.paragraphs[0]!.runs[0]!;
    expect(run.bold).toBeNull();
    expect(run.boldInXml()).toBe(true);
    expect(run.realBold()).toBe(true);
  });

  it("falls back to the run's character style for underline", async () => {
    const doc = await load(p(r(rPr('<w:rStyle w:val="ULStyle"/>'))), styles);
    const run = doc.paragraphs[0]!.runs[0]!;
    expect(run.underlineInXml()).toBe(true);
    expect(run.realUnderline()).toBe(true);
  });

  it("lets a direct toggle beat the style", async () => {
    const doc = await load(p(r(rPr('<w:rStyle w:val="BoldStyle"/><w:b w:val="0"/>'))), styles);
    const run = doc.paragraphs[0]!.runs[0]!;
    expect(run.boldInXml()).toBe(false);
    expect(run.isBoldOff()).toBe(true);
  });

  it("reads an unstyled run as not bold and not underlined", async () => {
    const doc = await load(p(r("")), styles);
    const run = doc.paragraphs[0]!.runs[0]!;
    expect(run.realBold()).toBe(false);
    expect(run.realUnderline()).toBe(false);
  });

  it("gives a run with no rStyle the default character style, never null", async () => {
    const doc = await load(p(r("")), styles);
    expect(doc.paragraphs[0]!.runs[0]!.style.name).toBe("Default Paragraph Font");
  });

  it("falls back to the default character style when the rStyle names nothing", async () => {
    const doc = await load(p(r(rPr('<w:rStyle w:val="Missing"/>'))), styles);
    expect(doc.paragraphs[0]!.runs[0]!.style.name).toBe("Default Paragraph Font");
  });

  it("assigns a style, and clears it back to the default", async () => {
    const doc = await load(p(r("")), styles);
    const run = doc.paragraphs[0]!.runs[0]!;
    run.style = doc.styles.byId("BoldStyle");
    expect(run.style.styleId).toBe("BoldStyle");
    run.style = null;
    expect(run.style.name).toBe("Default Paragraph Font");
  });
});

describe("Run font", () => {
  it("reads the size in points from the half-point attribute", async () => {
    const doc = await load(p(r(rPr('<w:sz w:val="22"/>'))));
    expect(doc.paragraphs[0]!.runs[0]!.font.sizePt).toBe(11);
  });

  it("has no size when the run sets none", async () => {
    expect((await load(p(r("")))).paragraphs[0]!.runs[0]!.font.sizePt).toBeNull();
    const doc = await load(p(r(rPr(""))));
    expect(doc.paragraphs[0]!.runs[0]!.font.sizePt).toBeNull();
  });

  it("reads a highlight colour", async () => {
    const doc = await load(p(r(rPr('<w:highlight w:val="yellow"/>'))));
    expect(doc.paragraphs[0]!.runs[0]!.font.highlightColor).toBe("yellow");
  });

  it("reads an explicit none highlight as no highlight", async () => {
    const doc = await load(p(r(rPr('<w:highlight w:val="none"/>'))));
    expect(doc.paragraphs[0]!.runs[0]!.font.highlightColor).toBeNull();
  });
});

describe("Run cleanup", () => {
  it("strips the formatting toggles it owns", async () => {
    const doc = await load(p(r(rPr('<w:b/><w:i/><w:u w:val="single"/><w:sz w:val="24"/>'))));
    const run = doc.paragraphs[0]!.runs[0]!;
    run.clearFormatting("always");
    expect(run.bold).toBeNull();
    expect(run.underline).toBeNull();
    expect(run.font.sizePt).toBeNull();
  });

  it("keeps a size of eight points or less when clearing conditionally", async () => {
    const doc = await load(p(r(rPr('<w:b/><w:sz w:val="16"/>'))));
    const run = doc.paragraphs[0]!.runs[0]!;
    run.clearFormatting("conditional");
    expect(run.font.sizePt).toBe(8);
    expect(run.bold).toBeNull();
  });

  it("clears a size above eight points when clearing conditionally", async () => {
    const doc = await load(p(r(rPr('<w:sz w:val="24"/>'))));
    const run = doc.paragraphs[0]!.runs[0]!;
    run.clearFormatting("conditional");
    expect(run.font.sizePt).toBeNull();
  });

  it("leaves the size alone when told to skip it", async () => {
    const doc = await load(p(r(rPr('<w:b/><w:sz w:val="24"/>'))));
    const run = doc.paragraphs[0]!.runs[0]!;
    run.clearFormatting("skip");
    expect(run.font.sizePt).toBe(12);
    expect(run.bold).toBeNull();
  });

  it("clears the size on its own", async () => {
    const doc = await load(p(r(rPr('<w:b/><w:sz w:val="24"/>'))));
    const run = doc.paragraphs[0]!.runs[0]!;
    run.clearSize();
    expect(run.font.sizePt).toBeNull();
    expect(run.bold).toBe(true);
  });

  it("removes the run's borders and shading", async () => {
    const doc = await load(p(r(rPr('<w:bdr w:val="single"/><w:shd w:val="clear"/>'))));
    const run = doc.paragraphs[0]!.runs[0]!;
    expect(run.hasBorder()).toBe(true);
    run.removeBorders();
    expect(run.hasBorder()).toBe(false);
  });

  it("is a no-op on a run that has no properties at all", async () => {
    const doc = await load(p(r("")));
    const run = doc.paragraphs[0]!.runs[0]!;
    expect(() => {
      run.clearFormatting("always");
      run.clearName();
      run.clearSize();
      run.removeBorders();
    }).not.toThrow();
  });

  it("keeps the run's text through every clear", async () => {
    const doc = await load(p(r(rPr('<w:b/><w:sz w:val="24"/>'), "kept")));
    const run = doc.paragraphs[0]!.runs[0]!;
    run.clearFormatting("always");
    expect(run.text).toBe("kept");
  });
});

describe("Paragraph", () => {
  it("joins its runs' text", async () => {
    const doc = await load(p(r("", "one ") + r("", "two")));
    expect(doc.paragraphs[0]!.text).toBe("one two");
  });

  it("reads its own outline level", async () => {
    const doc = await load(p('<w:pPr><w:outlineLvl w:val="2"/></w:pPr>' + r("")));
    expect(doc.paragraphs[0]!.outlineLevel).toBe(2);
  });

  it("has no outline level when it sets none", async () => {
    expect((await load(p(r("")))).paragraphs[0]!.outlineLevel).toBeNull();
  });

  it("inherits an outline level from a style based on a heading", async () => {
    const styles =
      STYLE_NORMAL +
      '<w:style w:type="paragraph" w:styleId="Heading4"><w:name w:val="heading 4"/><w:pPr><w:outlineLvl w:val="3"/></w:pPr></w:style>' +
      '<w:style w:type="paragraph" w:styleId="MyTag"><w:name w:val="My Tag"/><w:basedOn w:val="Heading4"/></w:style>';
    const doc = await load(p('<w:pPr><w:pStyle w:val="MyTag"/></w:pPr>' + r("")), styles);
    expect(doc.paragraphs[0]!.effectiveOutlineLevel()).toBe(3);
  });

  it("lets a direct outline level beat the one its style would give", async () => {
    const styles =
      STYLE_NORMAL +
      '<w:style w:type="paragraph" w:styleId="H4"><w:name w:val="heading 4"/><w:pPr><w:outlineLvl w:val="3"/></w:pPr></w:style>';
    const doc = await load(
      p('<w:pPr><w:pStyle w:val="H4"/><w:outlineLvl w:val="0"/></w:pPr>' + r("")),
      styles,
    );
    expect(doc.paragraphs[0]!.effectiveOutlineLevel()).toBe(0);
  });

  it("reads a paragraph as bold when a run is directly bold", async () => {
    const doc = await load(p(r(rPr("<w:b/>"))), STYLE_NORMAL);
    expect(doc.paragraphs[0]!.effectivelyBold()).toBe(true);
  });

  it("reads a paragraph as bold when its style is", async () => {
    const styles =
      STYLE_NORMAL +
      '<w:style w:type="paragraph" w:styleId="BoldPara"><w:name w:val="Bold Para"/><w:rPr><w:b/></w:rPr></w:style>';
    const doc = await load(p('<w:pPr><w:pStyle w:val="BoldPara"/></w:pPr>' + r("")), styles);
    expect(doc.paragraphs[0]!.effectivelyBold()).toBe(true);
  });

  it("lets a run's explicit bold-off exempt that run from a bold style", async () => {
    const styles =
      STYLE_NORMAL +
      '<w:style w:type="paragraph" w:styleId="BoldPara"><w:name w:val="Bold Para"/><w:rPr><w:b/></w:rPr></w:style>';
    const doc = await load(
      p('<w:pPr><w:pStyle w:val="BoldPara"/></w:pPr>' + r(rPr('<w:b w:val="0"/>'))),
      styles,
    );
    expect(doc.paragraphs[0]!.effectivelyBold()).toBe(false);
  });

  it("reads a plain paragraph as not bold", async () => {
    expect((await load(p(r("")), STYLE_NORMAL)).paragraphs[0]!.effectivelyBold()).toBe(false);
  });

  it("gives a paragraph with no pStyle the default paragraph style, never null", async () => {
    const doc = await load(p(r("")), STYLE_NORMAL);
    expect(doc.paragraphs[0]!.style.styleId).toBe("Normal");
  });

  it("assigns a style", async () => {
    const styles =
      STYLE_NORMAL +
      '<w:style w:type="paragraph" w:styleId="Tag"><w:name w:val="Tag"/></w:style>';
    const doc = await load(p(r("")), styles);
    doc.paragraphs[0]!.style = doc.styles.byId("Tag")!;
    expect(doc.paragraphs[0]!.style.styleId).toBe("Tag");
  });

  it("removes the spacing, indent and justification a paste brought in", async () => {
    const doc = await load(
      p('<w:pPr><w:spacing w:after="200"/><w:ind w:left="720"/><w:jc w:val="center"/></w:pPr>' + r("")),
    );
    const para = doc.paragraphs[0]!;
    para.removeParagraphFormatting();
    const pPr = para.el.getElementsByTagNameNS(W, "pPr")[0]!;
    expect(pPr.getElementsByTagNameNS(W, "spacing")).toHaveLength(0);
    expect(pPr.getElementsByTagNameNS(W, "ind")).toHaveLength(0);
    expect(pPr.getElementsByTagNameNS(W, "jc")).toHaveLength(0);
  });
});

describe("Style", () => {
  const styles =
    STYLE_NORMAL +
    STYLE_DEFAULT_FONT +
    '<w:style w:type="paragraph" w:styleId="H1"><w:name w:val="heading 1"/></w:style>' +
    '<w:style w:type="character" w:styleId="Cite"><w:name w:val="Cite"/><w:rPr><w:b/><w:u w:val="single"/><w:bdr w:val="single"/></w:rPr></w:style>';

  it("translates a builtin internal name into its UI name", async () => {
    const doc = await load("", styles);
    expect(doc.styles.byId("H1")!.name).toBe("Heading 1");
  });

  it("leaves a custom name alone", async () => {
    const doc = await load("", styles);
    expect(doc.styles.byId("Cite")!.name).toBe("Cite");
  });

  it("stores a builtin name back in its internal form", async () => {
    const doc = await load("", styles);
    const style = doc.styles.byId("Cite")!;
    style.name = "Heading 2";
    const nameEl = style.el.getElementsByTagNameNS(W, "name")[0]!;
    expect(getAttr(nameEl, "val")).toBe("heading 2");
    expect(style.name).toBe("Heading 2");
  });

  it("reports the style type as python-docx's integer", async () => {
    const doc = await load("", styles);
    expect(doc.styles.byId("Normal")!.type).toBe(1);
    expect(doc.styles.byId("Cite")!.type).toBe(2);
  });

  it("reports whether the style is its type's default", async () => {
    const doc = await load("", styles);
    expect(doc.styles.byId("Normal")!.isDefault).toBe(true);
    expect(doc.styles.byId("Cite")!.isDefault).toBe(false);
  });

  it("reads its own bold, underline and border", async () => {
    const doc = await load("", styles);
    const cite = doc.styles.byId("Cite")!;
    expect(cite.hasBold()).toBe(true);
    expect(cite.hasUnderline()).toBe(true);
    expect(cite.hasBorder()).toBe(true);
  });

  it("reads a style that sets none of them as having none", async () => {
    const doc = await load("", styles);
    const normal = doc.styles.byId("Normal")!;
    expect(normal.hasBold()).toBe(false);
    expect(normal.hasUnderline()).toBe(false);
    expect(normal.hasBorder()).toBe(false);
  });

  it("reads an explicit bold-off as not bold", async () => {
    const doc = await load(
      "",
      '<w:style w:type="character" w:styleId="X"><w:name w:val="X"/><w:rPr><w:b w:val="0"/></w:rPr></w:style>',
    );
    expect(doc.styles.byId("X")!.hasBold()).toBe(false);
    expect(doc.styles.byId("X")!.ownBoldState()).toBe(false);
  });

  it("reads its basedOn and link ids", async () => {
    const doc = await load(
      "",
      '<w:style w:type="paragraph" w:styleId="X"><w:name w:val="X"/><w:basedOn w:val="Normal"/><w:link w:val="XChar"/></w:style>',
    );
    const style = doc.styles.byId("X")!;
    expect(style.basedOnId()).toBe("Normal");
    expect(style.linkId()).toBe("XChar");
  });

  it("reads, sets and removes an alias", async () => {
    const doc = await load("", styles);
    const style = doc.styles.byId("Cite")!;
    expect(style.getAlias()).toBeNull();
    style.setAlias("Citation");
    expect(style.getAlias()).toBe("Citation");
    style.removeAlias();
    expect(style.getAlias()).toBeNull();
  });

  it("removes itself from the collection", async () => {
    const doc = await load("", styles);
    doc.styles.byId("Cite")!.remove();
    expect(doc.styles.byId("Cite")).toBeNull();
  });
});

describe("Styles collection", () => {
  const styles =
    STYLE_NORMAL +
    STYLE_DEFAULT_FONT +
    '<w:style w:type="paragraph" w:styleId="Tag"><w:name w:val="Tag"/></w:style>';

  it("looks a style up by id", async () => {
    const doc = await load("", styles);
    expect(doc.styles.byId("Tag")!.name).toBe("Tag");
    expect(doc.styles.byId("Nope")).toBeNull();
  });

  it("resolves by id first, then by UI name", async () => {
    const doc = await load("", styles);
    expect(doc.styles.get("Tag").styleId).toBe("Tag");
    expect(doc.styles.get("Default Paragraph Font").styleId).toBe("DefaultParagraphFont");
  });

  it("throws for a key naming no style", async () => {
    const doc = await load("", styles);
    expect(() => doc.styles.get("Nope")).toThrow(/no style with id or name/);
  });

  it("tests membership by UI name alone, as the cleaner relies on", async () => {
    const doc = await load("", styles);
    expect(doc.styles.has("Tag")).toBe(true);
    expect(doc.styles.has("DefaultParagraphFont")).toBe(false);
    expect(doc.styles.has("Default Paragraph Font")).toBe(true);
  });

  it("finds the default paragraph and character styles", async () => {
    const doc = await load("", styles);
    expect(doc.styles.defaultParagraphStyle().styleId).toBe("Normal");
    expect(doc.styles.defaultCharacterStyle().styleId).toBe("DefaultParagraphFont");
  });

  it("synthesizes a default when the document declares none", async () => {
    const doc = await load("", "");
    expect(doc.styles.defaultParagraphStyle().name).toBe("Normal");
    expect(doc.styles.defaultCharacterStyle().name).toBe("Default Paragraph Font");
  });

  it("resolves formatting up a basedOn chain", async () => {
    const chain =
      STYLE_NORMAL +
      '<w:style w:type="paragraph" w:styleId="A"><w:name w:val="A"/><w:pPr><w:outlineLvl w:val="1"/></w:pPr><w:rPr><w:b/></w:rPr></w:style>' +
      '<w:style w:type="paragraph" w:styleId="B"><w:name w:val="B"/><w:basedOn w:val="A"/></w:style>' +
      '<w:style w:type="paragraph" w:styleId="C"><w:name w:val="C"/><w:basedOn w:val="B"/></w:style>';
    const doc = await load("", chain);
    expect(doc.styles.effectiveStyleFormat("C")).toEqual({ outlineLevel: 1, bold: true });
  });

  it("lets a style's own value beat the one it inherits", async () => {
    const chain =
      STYLE_NORMAL +
      '<w:style w:type="paragraph" w:styleId="A"><w:name w:val="A"/><w:rPr><w:b/></w:rPr></w:style>' +
      '<w:style w:type="paragraph" w:styleId="B"><w:name w:val="B"/><w:basedOn w:val="A"/><w:rPr><w:b w:val="0"/></w:rPr></w:style>';
    const doc = await load("", chain);
    expect(doc.styles.effectiveStyleFormat("B").bold).toBe(false);
  });

  it("survives a basedOn cycle rather than recursing forever", async () => {
    const cyclic =
      '<w:style w:type="paragraph" w:styleId="A"><w:name w:val="A"/><w:basedOn w:val="B"/></w:style>' +
      '<w:style w:type="paragraph" w:styleId="B"><w:name w:val="B"/><w:basedOn w:val="A"/></w:style>';
    const doc = await load("", cyclic);
    expect(doc.styles.effectiveStyleFormat("A")).toEqual({ outlineLevel: null, bold: false });
  });

  it("resolves nothing for no style at all", async () => {
    const doc = await load("", styles);
    expect(doc.styles.effectiveStyleFormat(null)).toEqual({ outlineLevel: null, bold: false });
    expect(doc.styles.effectiveStyleFormat("Missing")).toEqual({
      outlineLevel: null,
      bold: false,
    });
  });

  it("sees a style added after the first lookup", async () => {
    const doc = await load("", styles);
    expect(doc.styles.byId("Injected")).toBeNull();
    const added = doc.injectMissingStyles(
      stylesXml('<w:style w:type="paragraph" w:styleId="Injected"><w:name w:val="Injected"/></w:style>'),
    );
    expect(added).toEqual(["Injected"]);
    expect(doc.styles.byId("Injected")!.name).toBe("Injected");
  });

  it("does not re-add a style the document already defines", async () => {
    const doc = await load("", styles);
    expect(doc.injectMissingStyles(stylesXml(STYLE_NORMAL))).toEqual([]);
  });

  it("sees a rename after the first lookup", async () => {
    const doc = await load("", styles);
    expect(doc.styles.has("Tag")).toBe(true);
    doc.styles.byId("Tag")!.name = "Renamed";
    expect(doc.styles.has("Tag")).toBe(false);
    expect(doc.styles.has("Renamed")).toBe(true);
  });
});

describe("OoxmlDoc.save", () => {
  it("writes the edited parts back into a package that reloads", async () => {
    const doc = await load(p(r(rPr("<w:b/>"), "hello")), STYLE_NORMAL);
    doc.paragraphs[0]!.runs[0]!.clearFormatting("always");

    const reloaded = await OoxmlDoc.fromDocx(await Docx.load(await doc.save()));
    expect(reloaded.paragraphs[0]!.text).toBe("hello");
    expect(reloaded.paragraphs[0]!.runs[0]!.bold).toBeNull();
  });

  it("keeps a style injected before the save", async () => {
    const doc = await load(p(r("")), STYLE_NORMAL);
    doc.injectMissingStyles(
      stylesXml('<w:style w:type="paragraph" w:styleId="Injected"><w:name w:val="Injected"/></w:style>'),
    );
    const reloaded = await OoxmlDoc.fromDocx(await Docx.load(await doc.save()));
    expect(reloaded.styles.byId("Injected")).not.toBeNull();
  });
});

describe("hyperlinks", () => {
  it("finds every hyperlink in the body", async () => {
    const doc = await load(p("<w:hyperlink>" + r("", "link") + "</w:hyperlink>") + p(r("", "plain")));
    expect(doc.hyperlinks()).toHaveLength(1);
  });

  it("finds none in a document that has none", async () => {
    expect((await load(p(r("")))).hyperlinks()).toEqual([]);
  });
});
