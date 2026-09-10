"use client";

/**
 * @fileoverview Turning files and editor content into the `.cmir` the app
 * stores, and back into the HTML the editor mounts.
 *
 * Every upload lands as CardMirror's own native file. It is the only format
 * that holds what CardMirror's OOXML reader gets out of a Verbatim document —
 * the card outline (pocket / hat / block / tag / analytic), highlighting,
 * comments and inline images — and the HTML the app used to keep instead
 * flattened all of it away. So nothing here converts an upload to card HTML,
 * and nothing here goes through the regex/mammoth card parser: the bytes go
 * `.docx` → CardMirror importer → `.cmir`, and the stored file stays `.cmir`
 * for the rest of its life, including after the reader edits it.
 *
 * `.cmir` is binary (gzipped JSON) and the columns holding it are SQLite text,
 * so the bytes travel base64-encoded — see `./format` for how a row says which
 * of the two shapes it is in.
 *
 * @module lib/cardmirror/stored-cmir
 */
import { docToHtml, htmlToDoc } from "debate-editor";
import {
  base64ToCmir,
  cmirToBase64,
  docxToCmir,
  looksLikeNative,
  parseNative,
  serializeNative,
  serializeNativeAsync,
} from "debate-editor/engine";
import { STORED_FORMATS, type StoredContent } from "./format";
import { isCmirContent } from "./content-format";

/** Written into each file's `createdBy` field, so a `.cmir` downloaded from
 *  the app says where it came from. */
const APP_VERSION = "debate-ai.com CardMirror import";

/** Extensions the upload path knows how to turn into a `.cmir`. Anything
 *  else is refused by name rather than failing deep inside a parser. */
export const IMPORTABLE_EXTENSIONS = [
  ".docx",
  ".cmir",
  ".html",
  ".htm",
  ".md",
  ".txt",
] as const;

/** The `accept` attribute for a file picker that feeds {@link fileToStoredCmir}. */
export const IMPORT_ACCEPT = IMPORTABLE_EXTENSIONS.join(",");

/** A file the app refused to import, with a reason worth showing. */
export class CardMirrorImportError extends Error {
  override name = "CardMirrorImportError";
}

/** Escapes text for interpolation into HTML. */
function escapeHtml(value: string): string {
  return value.replace(/[&<>]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[char]!);
}

/** `"1AC Warming.docx"` → `".docx"`, lowercased; `""` when there is none. */
export function fileExtension(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot === -1 ? "" : name.slice(dot).toLowerCase();
}

/**
 * Renders a stored row for the editor, whose `content` prop takes HTML.
 *
 * Legacy HTML rows pass through untouched. A `.cmir` is parsed with
 * CardMirror's native reader and serialized through its own schema, in the
 * browser where the editor bundle already lives, rather than making every
 * catalogue response pay for a conversion the reader may never open. One that
 * will not parse returns a notice rather than an empty document — a blank page
 * reads as a file with nothing in it, which is the one thing a damaged file is
 * not.
 */
export function storedContentToHtml(item: StoredContent): string {
  const content = item.content ?? "";
  if (!isCmirContent(item)) return content;
  try {
    return docToHtml(parseNative(base64ToCmir(content)).doc);
  } catch (error) {
    console.error("[cardmirror] could not open stored .cmir", error);
    return `<p>This file could not be opened (${escapeHtml(
      error instanceof Error ? error.message : String(error),
    )}).</p>`;
  }
}

/**
 * Re-encodes what the editor reports back into the `.cmir` its row holds, so
 * editing an imported file keeps it in CardMirror's format instead of
 * silently downgrading it to HTML on the first keystroke.
 *
 * The gzip runs off the main thread (`serializeNativeAsync`), which is why
 * this is async — callers debounce it the same way they debounce the write.
 */
export async function htmlToStoredCmir(html: string): Promise<string> {
  return cmirToBase64(await serializeNativeAsync(htmlToDoc(html), { appVersion: APP_VERSION }));
}

/**
 * {@link htmlToStoredCmir} with the gzip on this thread.
 *
 * For the one caller that cannot await: the page is going away (`pagehide`,
 * or a backgrounded tab) and an edit still waiting to be encoded has to become
 * bytes *now* or be lost. Stalling a frame of a page that is already closing
 * is the cheaper of the two.
 */
export function htmlToStoredCmirSync(html: string): string {
  return cmirToBase64(serializeNative(htmlToDoc(html), { appVersion: APP_VERSION }));
}

/** What an upload becomes: one row's worth of stored file. */
export interface ImportedFile {
  /** The file name as uploaded, extension included, so the sidebar shows the
   *  `.docx` the reader dropped rather than a renamed copy of it. */
  title: string;
  /** Base64 `.cmir`. */
  content: string;
  format: typeof STORED_FORMATS.cmir;
}

/** Wraps plain text so each line survives as its own paragraph. */
function textToHtml(text: string): string {
  return (
    text
      .split(/\r?\n/)
      .map((line) => `<p>${escapeHtml(line)}</p>`)
      .join("") || "<p></p>"
  );
}

/**
 * Converts one uploaded file to the `.cmir` a row stores.
 *
 * @throws {CardMirrorImportError} For a name this path does not import, an
 * empty file, or bytes that are not what their extension claims — each with
 * the remedy, so the sidebar can say what to do rather than "import failed".
 */
export async function fileToStoredCmir(file: File): Promise<ImportedFile> {
  const extension = fileExtension(file.name);
  if (!(IMPORTABLE_EXTENSIONS as readonly string[]).includes(extension)) {
    throw new CardMirrorImportError(
      `${file.name} isn’t a file CardMirror can open. Upload ${IMPORTABLE_EXTENSIONS.join(", ")}.`,
    );
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (bytes.byteLength === 0) {
    throw new CardMirrorImportError(
      `${file.name} is empty. If it lives in Dropbox or iCloud Drive it may not have downloaded yet.`,
    );
  }

  const base = { title: file.name, format: STORED_FORMATS.cmir } as const;

  if (extension === ".cmir") {
    // Already native — keep the uploaded bytes rather than re-serializing, so
    // comments, the doc id and everything else in the envelope survive. Parse
    // first so a mislabelled file is refused now instead of on open.
    if (!looksLikeNative(bytes)) {
      throw new CardMirrorImportError(
        `${file.name} is named .cmir but isn’t a CardMirror file.`,
      );
    }
    try {
      parseNative(bytes);
    } catch (error) {
      throw new CardMirrorImportError(
        `${file.name} could not be opened (${error instanceof Error ? error.message : String(error)}).`,
      );
    }
    return { ...base, content: cmirToBase64(bytes) };
  }

  if (extension === ".docx") {
    let result: Awaited<ReturnType<typeof docxToCmir>>;
    try {
      result = await docxToCmir(bytes, { appVersion: APP_VERSION });
    } catch (error) {
      throw new CardMirrorImportError(
        `${file.name} could not be converted to a CardMirror file (${
          error instanceof Error ? error.message : String(error)
        }). Open it in Word and use Save As → Word Document (.docx), then upload it again.`,
      );
    }
    if (!result.doc.textContent.trim()) {
      throw new CardMirrorImportError(
        `${file.name} opened but contains no text. Check that its content is not stored only in text boxes, images or a linked file.`,
      );
    }
    return { ...base, content: cmirToBase64(result.bytes) };
  }

  const text = new TextDecoder().decode(bytes);
  const html = extension === ".html" || extension === ".htm" ? text : textToHtml(text);
  return { ...base, content: await htmlToStoredCmir(html) };
}
