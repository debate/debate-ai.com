/**
 * @fileoverview How an uploaded DOCX is stored, and how a stored row is read
 * back.
 *
 * The library's contract after the `.cmir` switch: an import writes a
 * CardMirror native file (the same bytes the desktop app writes), the rows
 * imported before it still read as HTML, and a file that fails to convert
 * fails with a coded reason the admin UI can show rather than a generic
 * error.
 */
import { describe, expect, it } from "vitest";
import { DocxImportError } from "debate-card-parser";
import { base64ToCmir, parseNative, schema, toDocx } from "debate-editor/engine";

import { TOPIC_STARTER_FORMATS, isCmirContent } from "../format";
import { docxToStoredCmir } from "../import";

/** Builds one schema block; PM's `create` takes an array of children. */
const textBlock = (name: string, value: string) =>
  schema.nodes[name]!.create(null, value ? [schema.text(value)] : []);

/** A one-card document, exported to DOCX the way Word would hand it to us. */
async function sampleDocx(): Promise<ArrayBuffer> {
  const doc = schema.nodes["doc"]!.create(null, [
    schema.nodes["card"]!.create(null, [
      textBlock("tag", "Deterrence fails"),
      textBlock("cite_paragraph", "Nguyen 25"),
      textBlock("card_body", "Escalation is uncontrollable."),
    ]),
  ]);
  const bytes = await toDocx(doc);
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

describe("docxToStoredCmir", () => {
  it("stores a parseable .cmir carrying the document's text", async () => {
    const stored = await docxToStoredCmir(await sampleDocx());
    const parsed = parseNative(base64ToCmir(stored));
    expect(parsed.doc.textContent).toContain("Deterrence fails");
    expect(parsed.doc.textContent).toContain("Escalation is uncontrollable.");
  });

  it("names the file's origin so a downloaded .cmir says where it came from", async () => {
    const stored = await docxToStoredCmir(await sampleDocx());
    expect(parseNative(base64ToCmir(stored)).meta.createdBy).toContain("debate-ai.com");
  });

  it("rejects a legacy .doc with the remedy, not a conversion error", async () => {
    // OLE2 compound-file magic — a Word 97 file renamed to .docx.
    const ole = new Uint8Array([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1, 0, 0]);
    await expect(docxToStoredCmir(ole.buffer as ArrayBuffer)).rejects.toMatchObject({
      code: "legacy-doc",
    });
  });

  it("codes a file that is a ZIP but not a Word document", async () => {
    const notWord = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0, 0, 0, 0, 0, 0]);
    const error = await docxToStoredCmir(notWord.buffer as ArrayBuffer).catch((e) => e);
    expect(error).toBeInstanceOf(DocxImportError);
    expect(error.message).toMatch(/CardMirror file|Re-save/);
  });

  it("refuses a document with no text rather than storing an empty file", async () => {
    const bytes = await toDocx(schema.nodes["doc"]!.create(null, [textBlock("paragraph", "")]));
    const buffer = bytes.buffer.slice(
      bytes.byteOffset,
      bytes.byteOffset + bytes.byteLength,
    ) as ArrayBuffer;
    await expect(docxToStoredCmir(buffer)).rejects.toMatchObject({ code: "empty-document" });
  });
});

describe("isCmirContent", () => {
  it("trusts the format column", async () => {
    const stored = await docxToStoredCmir(await sampleDocx());
    expect(isCmirContent({ content: stored, format: TOPIC_STARTER_FORMATS.cmir })).toBe(true);
    expect(isCmirContent({ content: "<p>legacy</p>", format: TOPIC_STARTER_FORMATS.html })).toBe(
      false,
    );
  });

  it("falls back to the content when no format travels with it", async () => {
    const stored = await docxToStoredCmir(await sampleDocx());
    expect(isCmirContent({ content: stored })).toBe(true);
    expect(isCmirContent({ content: "<h1>Deterrence fails</h1>" })).toBe(false);
  });

  it("treats an empty row (a folder) as neither", () => {
    expect(isCmirContent({ content: "" })).toBe(false);
    expect(isCmirContent({ content: null, format: TOPIC_STARTER_FORMATS.cmir })).toBe(false);
  });
});
