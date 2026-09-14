// @vitest-environment jsdom
/**
 * @fileoverview Covers the DOCX → HTML stage and the DOCX → cards pipeline on
 * top of it. Both render paths are exercised against real (if minimal) .docx
 * packages built in memory with JSZip, since the whole point of this module is
 * turning Word's style ids into the h1–h6 structure the card parser segments on.
 *
 * jsdom is required: the docx-preview path needs a DOMParser.
 */

import JSZip from "jszip";
import { describe, expect, it } from "vitest";

import { convertDocxToHTML, styleMap } from "../src/parsers/docx-to-html";
import { docxToCards, docxToHtml } from "../src/parsers/docx-to-cards";

const W =
  'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"';

const paragraph = (text: string, style?: string) =>
  `<w:p>${
    style ? `<w:pPr><w:pStyle w:val="${style}"/></w:pPr>` : ""
  }<w:r><w:t>${text}</w:t></w:r></w:p>`;

const STYLES_XML = `<?xml version="1.0"?><w:styles ${W}>
  <w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:pPr><w:outlineLvl w:val="0"/></w:pPr></w:style>
  <w:style w:type="paragraph" w:styleId="Heading4"><w:name w:val="heading 4"/><w:pPr><w:outlineLvl w:val="3"/></w:pPr></w:style>
  <w:style w:type="character" w:styleId="Highlight"><w:name w:val="Highlight"/><w:rPr><w:highlight w:val="yellow"/><w:b/><w:u/></w:rPr></w:style>
</w:styles>`;

/** Builds a minimal but structurally complete .docx package in memory. */
async function makeDocx(
  body: string,
  { styles = true }: { styles?: boolean } = {},
): Promise<ArrayBuffer> {
  const zip = new JSZip();
  zip.file(
    "[Content_Types].xml",
    `<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>`,
  );
  zip.file(
    "_rels/.rels",
    `<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`,
  );
  zip.file(
    "word/_rels/document.xml.rels",
    `<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`,
  );
  zip.file(
    "word/document.xml",
    `<?xml version="1.0"?><w:document ${W}><w:body>${body}</w:body></w:document>`,
  );
  if (styles) zip.file("word/styles.xml", STYLES_XML);
  return zip.generateAsync({ type: "arraybuffer" });
}

const CARD_BODY =
  paragraph("Politics DA", "Heading1") +
  paragraph("Plan drains capital", "Heading4") +
  paragraph("Smith 23 (Jane Smith, Reuters, 2023)") +
  paragraph("Body text of the card runs on for a while here.");

describe("convertDocxToHTML input handling", () => {
  it("returns an empty string for empty input", async () => {
    await expect(convertDocxToHTML("")).resolves.toBe("");
  });

  it("rejects an input type it cannot read", async () => {
    await expect(convertDocxToHTML(123 as never)).rejects.toThrow(
      /Unsupported input type/,
    );
  });

  it("rejects bytes that are not a zip container", async () => {
    await expect(convertDocxToHTML(new ArrayBuffer(8))).rejects.toThrow();
  });

  it("accepts an ArrayBuffer", async () => {
    const html = await convertDocxToHTML(await makeDocx(CARD_BODY), {
      useDocxPreview: false,
    });
    expect(html).toContain("Politics DA");
  });

  it("accepts a Node Buffer sliced to its own byte window", async () => {
    const bytes = new Uint8Array(await makeDocx(CARD_BODY));
    // Pad on both sides so a naive `.buffer` read would pick up the padding.
    const padded = new Uint8Array(bytes.length + 8);
    padded.set(bytes, 4);
    const buffer = Buffer.from(padded.buffer, 4, bytes.length);
    const html = await convertDocxToHTML(buffer, { useDocxPreview: false });
    expect(html).toContain("Politics DA");
  });

  it("accepts a Blob", async () => {
    const blob = new Blob([await makeDocx(CARD_BODY)]);
    const html = await convertDocxToHTML(blob, { useDocxPreview: false });
    expect(html).toContain("Politics DA");
  });
});

describe("convertDocxToHTML manual parsing path", () => {
  const manual = (body: string, opts = {}) =>
    makeDocx(body).then((buf) =>
      convertDocxToHTML(buf, { useDocxPreview: false, ...opts }),
    );

  it("maps Word outline levels onto html headings", async () => {
    const html = await manual(CARD_BODY);
    expect(html).toContain("<h1>Politics DA</h1>");
    expect(html).toContain("<h4>Plan drains capital</h4>");
  });

  it("renders unstyled paragraphs as <p>", async () => {
    expect(await manual(paragraph("just a paragraph"))).toContain(
      "<p>just a paragraph</p>",
    );
  });

  it("drops all markup when asked for plain text only", async () => {
    const text = await manual(CARD_BODY, { plainTextOnly: true });
    expect(text).not.toContain("<");
    expect(text).toContain("Politics DA");
    expect(text).toContain("Plan drains capital");
  });

  it("still converts a document with no styles.xml", async () => {
    const buf = await makeDocx(paragraph("no styles here"), { styles: false });
    expect(await convertDocxToHTML(buf, { useDocxPreview: false })).toContain(
      "no styles here",
    );
  });

  it("throws when word/document.xml is missing", async () => {
    const zip = new JSZip();
    zip.file("[Content_Types].xml", "<Types/>");
    zip.file("word/styles.xml", STYLES_XML);
    const buf = await zip.generateAsync({ type: "arraybuffer" });
    await expect(
      convertDocxToHTML(buf, { useDocxPreview: false }),
    ).rejects.toThrow(/document\.xml/);
  });
});

describe("convertDocxToHTML docx-preview path", () => {
  it("renders through docx-preview by default", async () => {
    const html = await convertDocxToHTML(await makeDocx(CARD_BODY));
    expect(html).toContain("Politics DA");
    expect(html).toContain("Body text of the card");
  });

  it("promotes styled paragraphs to headings the card parser can segment on", async () => {
    const html = await convertDocxToHTML(await makeDocx(CARD_BODY));
    expect(html).toMatch(/<h1[^>]*>/);
    expect(html).toMatch(/<h4[^>]*>/);
  });

  it("drops all markup when asked for plain text only", async () => {
    const text = await convertDocxToHTML(await makeDocx(CARD_BODY), {
      plainTextOnly: true,
    });
    expect(text).not.toContain("<");
    expect(text).toContain("Politics DA");
  });
});

describe("styleMap", () => {
  it("names the Verbatim styles the converter recognizes", () => {
    for (const key of ["pocket", "hat", "block", "tag", "text"]) {
      expect(styleMap).toHaveProperty(key);
    }
  });

  it("maps the inline emphasis styles a cut card relies on", () => {
    for (const key of ["underline", "strong", "mark"]) {
      expect(styleMap).toHaveProperty(key);
    }
  });
});

describe("docxToCards", () => {
  it("runs the whole DOCX to cards pipeline", async () => {
    const result = await docxToCards(
      await makeDocx(CARD_BODY),
      "Politics DA - Harvard 2023.docx",
    );
    expect(result.metadata).toMatchObject({
      category: "Politics DA",
      organization: "Harvard",
      year: 2023,
    });
    expect(result.outline.length).toBeGreaterThan(0);
  });

  it("passes parser options through to the card parser", async () => {
    const buf = await makeDocx(CARD_BODY);
    const standard = await docxToCards(buf, undefined, { headingTags: ["h1"] });
    // With only h1 treated as a heading, the h4 tag line cannot open a card.
    expect(standard.metadata.quotes).toBe(0);
  });
});

describe("docxToHtml", () => {
  it("returns html without parsing it into cards", async () => {
    const html = await docxToHtml(await makeDocx(CARD_BODY), {
      useDocxPreview: false,
    });
    expect(html).toContain("<h1>Politics DA</h1>");
  });

  it("defaults to the docx-preview renderer", async () => {
    expect(await docxToHtml(await makeDocx(CARD_BODY))).toContain(
      "Politics DA",
    );
  });
});
