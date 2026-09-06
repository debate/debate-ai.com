import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import {
  DOCX_IMPORT_LIMITS,
  DocxImportError,
  assertReadableDocxBytes,
  collectDocxEntries,
  decodeXmlEntities,
  describeDocxImportError,
  detectFileSignature,
  documentXmlToHtml,
  docxBytesToHtml,
  escapeHtml,
  formatBytes,
  isImportableDocxEntry,
  normalizeImportPath,
  paragraphTagForStyle,
  summarizeImportOutcome,
} from "../src/parsers/docx-import";

const bytesOf = (...values: number[]) => new Uint8Array(values).buffer;

const paragraph = (text: string, options: { style?: string; mark?: boolean; underline?: boolean } = {}) => {
  const properties = [
    options.mark ? '<w:highlight w:val="yellow"/>' : "",
    options.underline ? "<w:u/>" : "",
  ].join("");
  return [
    "<w:p>",
    options.style ? `<w:pPr><w:pStyle w:val="${options.style}"/></w:pPr>` : "",
    "<w:r>",
    properties ? `<w:rPr>${properties}</w:rPr>` : "",
    `<w:t>${text}</w:t>`,
    "</w:r></w:p>",
  ].join("");
};

const documentXml = (body: string) =>
  `<?xml version="1.0"?><w:document xmlns:w="x"><w:body>${body}</w:body></w:document>`;

/** Builds a minimal but real .docx in memory. */
async function makeDocx(body: string): Promise<ArrayBuffer> {
  const zip = new JSZip();
  zip.file("[Content_Types].xml", "<Types/>");
  zip.file("word/document.xml", documentXml(body));
  return zip.generateAsync({ type: "arraybuffer" });
}

describe("decodeXmlEntities", () => {
  it("resolves named, decimal and hex references", () => {
    expect(decodeXmlEntities("A &amp; B &#39;c&#39; &#x2014; d")).toBe("A & B 'c' — d");
  });

  it("decodes each reference once so escaped markup survives", () => {
    // A repeated-pass decode would turn this into "<b>", losing the fact that
    // the document literally contains the text "&lt;b&gt;".
    expect(decodeXmlEntities("&amp;lt;b&amp;gt;")).toBe("&lt;b&gt;");
  });

  it("leaves unknown entities alone", () => {
    expect(decodeXmlEntities("&notanentity;")).toBe("&notanentity;");
  });
});

describe("escapeHtml", () => {
  it("escapes every HTML-significant character", () => {
    expect(escapeHtml(`<a href="x">&'`)).toBe("&lt;a href=&quot;x&quot;&gt;&amp;&#39;");
  });
});

describe("detectFileSignature", () => {
  it("recognizes a ZIP header", () => {
    expect(detectFileSignature(bytesOf(0x50, 0x4b, 0x03, 0x04))).toBe("zip");
  });

  it("recognizes an OLE2 header (legacy .doc or encrypted export)", () => {
    expect(detectFileSignature(bytesOf(0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1))).toBe("ole");
  });

  it("recognizes a PDF header", () => {
    expect(detectFileSignature(bytesOf(0x25, 0x50, 0x44, 0x46, 0x2d))).toBe("pdf");
  });

  it("reports an empty file", () => {
    expect(detectFileSignature(new ArrayBuffer(0))).toBe("empty");
  });

  it("falls back to unknown", () => {
    expect(detectFileSignature(bytesOf(0x01, 0x02, 0x03, 0x04))).toBe("unknown");
  });
});

describe("isImportableDocxEntry", () => {
  it("accepts a nested DOCX", () => {
    expect(isImportableDocxEntry("Aff/Impacts/warming.docx")).toBe(true);
  });

  it("rejects directories and non-DOCX files", () => {
    expect(isImportableDocxEntry("Aff/", true)).toBe(false);
    expect(isImportableDocxEntry("Aff/notes.pdf")).toBe(false);
  });

  it("rejects macOS resource forks that masquerade as DOCX", () => {
    expect(isImportableDocxEntry("__MACOSX/Aff/._warming.docx")).toBe(false);
    expect(isImportableDocxEntry("Aff/._warming.docx")).toBe(false);
  });

  it("rejects Word lock files and dotfiles", () => {
    expect(isImportableDocxEntry("Aff/~$warming.docx")).toBe(false);
    expect(isImportableDocxEntry("Aff/.hidden.docx")).toBe(false);
  });

  it("is case-insensitive about the extension", () => {
    expect(isImportableDocxEntry("Aff/WARMING.DOCX")).toBe(true);
  });
});

describe("normalizeImportPath", () => {
  it("strips traversal, drive letters and absolute roots", () => {
    expect(normalizeImportPath("/../C:/Aff/../Neg/da.docx")).toBe("Aff/Neg/da.docx");
  });

  it("normalizes Windows separators", () => {
    expect(normalizeImportPath("Aff\\Impacts\\warming.docx")).toBe("Aff/Impacts/warming.docx");
  });
});

describe("paragraphTagForStyle", () => {
  it("maps Word heading styles to heading tags", () => {
    expect(paragraphTagForStyle("Heading1")).toBe("h1");
    expect(paragraphTagForStyle("heading-4")).toBe("h4");
  });

  it("falls back to a paragraph", () => {
    expect(paragraphTagForStyle(undefined)).toBe("p");
    expect(paragraphTagForStyle("BodyText")).toBe("p");
  });
});

describe("documentXmlToHtml", () => {
  it("keeps the heading outline a card library is built around", () => {
    const html = documentXmlToHtml(
      documentXml(paragraph("Warming DA", { style: "Heading3" }) + paragraph("Body text")),
    );
    expect(html).toBe("<h3>Warming DA</h3><p>Body text</p>");
  });

  it("preserves highlighting and underlining", () => {
    const html = documentXmlToHtml(documentXml(paragraph("key warrant", { mark: true, underline: true })));
    expect(html).toBe("<p><mark><u>key warrant</u></mark></p>");
  });

  it("treats an explicitly disabled highlight as plain text", () => {
    const xml = documentXml(
      '<w:p><w:r><w:rPr><w:u w:val="none"/></w:rPr><w:t>plain</w:t></w:r></w:p>',
    );
    expect(documentXmlToHtml(xml)).toBe("<p>plain</p>");
  });

  it("escapes text rather than injecting markup from the document", () => {
    const html = documentXmlToHtml(documentXml(paragraph("5 &lt; 6 &amp; rising")));
    expect(html).toBe("<p>5 &lt; 6 &amp; rising</p>");
  });

  it("renders tabs and breaks inside a run", () => {
    const xml = documentXml("<w:p><w:r><w:t>a</w:t><w:tab/><w:t>b</w:t><w:br/><w:t>c</w:t></w:r></w:p>");
    expect(documentXmlToHtml(xml)).toBe("<p>a b<br />c</p>");
  });

  it("drops paragraphs that carry no text", () => {
    const xml = documentXml("<w:p/><w:p><w:r><w:br/></w:r></w:p>" + paragraph("real"));
    expect(documentXmlToHtml(xml)).toBe("<p>real</p>");
  });

  it("returns an empty string for a document with no text", () => {
    expect(documentXmlToHtml(documentXml("<w:p/>"))).toBe("");
  });
});

describe("assertReadableDocxBytes", () => {
  it("names a legacy .doc renamed to .docx", () => {
    try {
      assertReadableDocxBytes(bytesOf(0xd0, 0xcf, 0x11, 0xe0));
      expect.unreachable("should have thrown");
    } catch (error) {
      expect(error).toBeInstanceOf(DocxImportError);
      expect((error as DocxImportError).code).toBe("legacy-doc");
      expect((error as DocxImportError).message).toMatch(/Save As/);
    }
  });

  it("names a PDF renamed to .docx", () => {
    expect(() => assertReadableDocxBytes(bytesOf(0x25, 0x50, 0x44, 0x46))).toThrowError(/PDF/);
  });

  it("rejects an empty file", () => {
    expect(() => assertReadableDocxBytes(new ArrayBuffer(0))).toThrowError(/empty/i);
  });

  it("rejects a file over the per-file limit", () => {
    const oversized = { byteLength: DOCX_IMPORT_LIMITS.maxFileBytes + 1, slice: () => bytesOf(0x50, 0x4b) } as unknown as ArrayBuffer;
    expect(() => assertReadableDocxBytes(oversized)).toThrowError(/per-file limit/);
  });

  it("accepts a ZIP-headed file", () => {
    expect(() => assertReadableDocxBytes(bytesOf(0x50, 0x4b, 0x03, 0x04))).not.toThrow();
  });
});

describe("docxBytesToHtml", () => {
  it("converts a real DOCX", async () => {
    const docx = await makeDocx(paragraph("Extinction outweighs", { style: "Heading4" }));
    await expect(docxBytesToHtml(docx)).resolves.toBe("<h4>Extinction outweighs</h4>");
  });

  it("reports a ZIP that is not a Word document", async () => {
    const zip = new JSZip();
    zip.file("readme.txt", "hello");
    const bytes = await zip.generateAsync({ type: "arraybuffer" });
    await expect(docxBytesToHtml(bytes)).rejects.toMatchObject({ code: "missing-document-xml" });
  });

  it("reports a password-protected export", async () => {
    const zip = new JSZip();
    zip.file("EncryptedPackage", "\u0000binary");
    const bytes = await zip.generateAsync({ type: "arraybuffer" });
    await expect(docxBytesToHtml(bytes)).rejects.toThrowError(/password-protected/);
  });

  it("reports a DOCX whose body has no text", async () => {
    const docx = await makeDocx("<w:p/>");
    await expect(docxBytesToHtml(docx)).rejects.toMatchObject({ code: "empty-document" });
  });

  it("reports a truncated archive", async () => {
    const docx = await makeDocx(paragraph("x"));
    const truncated = docx.slice(0, 40);
    await expect(docxBytesToHtml(truncated)).rejects.toMatchObject({ code: "corrupt-zip" });
  });
});

describe("collectDocxEntries", () => {
  it("returns a single uploaded DOCX", async () => {
    const docx = await makeDocx(paragraph("x"));
    const entries = await collectDocxEntries("warming.docx", docx);
    expect(entries.map((entry) => entry.path)).toEqual(["warming.docx"]);
  });

  it("walks a ZIP and skips archive debris", async () => {
    const zip = new JSZip();
    zip.file("Aff/warming.docx", await makeDocx(paragraph("a")));
    zip.file("Aff/notes.pdf", "not a docx");
    zip.file("__MACOSX/Aff/._warming.docx", "resource fork");
    zip.file("Aff/~$warming.docx", "lock file");
    const bytes = await zip.generateAsync({ type: "arraybuffer" });

    const entries = await collectDocxEntries("camp.zip", bytes);
    expect(entries.map((entry) => entry.path)).toEqual(["Aff/warming.docx"]);
  });

  it("explains a ZIP that holds no DOCX at all", async () => {
    const zip = new JSZip();
    zip.file("notes.pdf", "x");
    zip.file("outline.txt", "y");
    const bytes = await zip.generateAsync({ type: "arraybuffer" });
    await expect(collectDocxEntries("camp.zip", bytes)).rejects.toMatchObject({
      code: "no-docx-in-zip",
    });
    await expect(collectDocxEntries("camp.zip", bytes)).rejects.toThrowError(/2 files/);
  });

  it("rejects an unsupported extension", async () => {
    await expect(collectDocxEntries("notes.pages", bytesOf(0x50, 0x4b))).rejects.toMatchObject({
      code: "unsupported-extension",
    });
  });

  it("rejects a legacy .doc before it becomes an opaque per-file failure", async () => {
    await expect(
      collectDocxEntries("warming.docx", bytesOf(0xd0, 0xcf, 0x11, 0xe0)),
    ).rejects.toMatchObject({ code: "legacy-doc" });
  });

  it("rejects an empty upload", async () => {
    await expect(collectDocxEntries("warming.docx", new ArrayBuffer(0))).rejects.toMatchObject({
      code: "empty-file",
    });
  });
});

describe("describeDocxImportError", () => {
  it("passes a coded error through", () => {
    const described = describeDocxImportError(new DocxImportError("too-large", "Too big."));
    expect(described).toEqual({ code: "too-large", reason: "Too big." });
  });

  it("wraps an unexpected error", () => {
    expect(describeDocxImportError(new Error("boom"))).toEqual({
      code: "unknown",
      reason: "Unexpected import error: boom",
    });
  });

  it("handles a non-Error throw", () => {
    expect(describeDocxImportError("nope").code).toBe("unknown");
  });
});

describe("formatBytes", () => {
  it("scales the unit to the size", () => {
    expect(formatBytes(512)).toBe("512B");
    expect(formatBytes(2048)).toBe("2KB");
    expect(formatBytes(5 * 1024 * 1024)).toBe("5.0MB");
  });
});

describe("summarizeImportOutcome", () => {
  const failure = { path: "a.docx", code: "unknown" as const, reason: "x" };

  it("reports a clean run", () => {
    expect(summarizeImportOutcome(3, [])).toBe("Imported 3 DOCX files.");
  });

  it("reports a partial run honestly", () => {
    expect(summarizeImportOutcome(2, [failure])).toBe("Imported 2 DOCX files; 1 failed.");
  });

  it("reports a total failure", () => {
    expect(summarizeImportOutcome(0, [failure, failure])).toBe(
      "Nothing imported — 2 DOCX files failed.",
    );
  });
});
