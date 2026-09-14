/**
 * @fileoverview Converts an uploaded `.docx` into the `.cmir` a Topic Starter
 * row stores.
 *
 * The library used to keep card HTML produced by a regex pass over
 * `word/document.xml`, which flattened Verbatim's outline (pocket / hat /
 * block / tag) into `<h1>`…`<p>` and dropped comments, images and every mark
 * the schema knows but HTML has no element for. CardMirror's own OOXML
 * importer keeps all of it, and `.cmir` — its native format — is the only
 * form that can hold the result losslessly, so that is what is stored.
 *
 * Failures stay diagnosable: the pre-checks that used to run inside
 * `docxBytesToHtml` run here, so a `.doc` renamed to `.docx` inside a ZIP
 * still comes back as `legacy-doc` with the remedy, not as an opaque
 * conversion error.
 *
 * @module lib/topic-starters/import
 */
import { DocxImportError, assertReadableDocxBytes } from "debate-card-parser";
import { cmirToBase64, docxToCmir } from "debate-editor/engine";

/** Written into each file's `createdBy` field, so a `.cmir` downloaded from
 *  the library says where it came from. */
const APP_VERSION = "debate-ai.com Topic Starter import";

/**
 * Converts one `.docx` to the base64 `.cmir` stored in `content`.
 *
 * @param bytes - The DOCX file's bytes.
 * @returns Base64-encoded `.cmir`.
 * @throws {DocxImportError} When the bytes are not a readable, non-empty DOCX.
 */
export async function docxToStoredCmir(bytes: ArrayBuffer): Promise<string> {
  assertReadableDocxBytes(bytes);

  let result: Awaited<ReturnType<typeof docxToCmir>>;
  try {
    result = await docxToCmir(bytes, { appVersion: APP_VERSION });
  } catch (error) {
    // The importer throws plain Errors ("docx is missing word/document.xml",
    // schema failures). Coding them here keeps the admin UI's per-file reason
    // as specific as the ones the pre-checks raise.
    throw new DocxImportError(
      "missing-document-xml",
      `The DOCX could not be converted to a CardMirror file (${
        error instanceof Error ? error.message : String(error)
      }). Re-save it from Word and upload again.`,
    );
  }

  if (!result.doc.textContent.trim()) {
    throw new DocxImportError(
      "empty-document",
      "The DOCX opened but contains no text. Check that the content is not stored only in text boxes, images or a linked file.",
    );
  }
  return cmirToBase64(result.bytes);
}
