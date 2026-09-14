/**
 * @fileoverview Diagnosable DOCX import: turns an uploaded `.docx` (or a `.zip`
 * of them) into card HTML, and turns every failure along the way into a coded,
 * human-readable reason.
 *
 * Bulk DOCX imports fail for a small set of boring reasons — a `.doc` renamed
 * to `.docx`, a password-protected export, a macOS zip full of `__MACOSX`
 * resource forks, a file that is really a PDF. Previously all of these
 * surfaced as one opaque "Upload failed", so the importer's caller could not
 * tell the operator what to fix. Every throw here carries a
 * {@link DocxImportErrorCode} and a sentence naming the remedy, and every
 * per-file failure is reported without aborting the rest of the batch.
 *
 * @module parsers/docx-import
 */
import JSZip from "jszip";

/** Size and count ceilings applied to a single import request. */
export const DOCX_IMPORT_LIMITS = {
  /** Most DOCX files accepted from one upload. */
  maxFiles: 100,
  /** Largest single DOCX, uncompressed. Verbatim files rarely pass ~10MB. */
  maxFileBytes: 25 * 1024 * 1024,
  /** Largest upload body accepted, DOCX or ZIP. */
  maxUploadBytes: 100 * 1024 * 1024,
} as const;

/**
 * Machine-readable cause of an import failure.
 *
 * Kept stable so logs and the admin UI can group failures by cause instead of
 * by message text.
 */
export type DocxImportErrorCode =
  | "empty-file"
  | "unsupported-extension"
  | "too-large"
  | "too-many-files"
  | "legacy-doc"
  | "not-a-zip"
  | "corrupt-zip"
  | "missing-document-xml"
  | "empty-document"
  | "no-docx-in-zip"
  | "unknown";

/** An import failure that already knows how to explain itself. */
export class DocxImportError extends Error {
  readonly code: DocxImportErrorCode;

  constructor(code: DocxImportErrorCode, message: string) {
    super(message);
    this.name = "DocxImportError";
    this.code = code;
  }
}

/** One file that could not be imported, paired with why. */
export interface DocxImportFailure {
  /** Path of the file inside the upload, or the upload's own name. */
  path: string;
  code: DocxImportErrorCode;
  /** Operator-facing sentence naming the remedy. */
  reason: string;
}

/** A DOCX pulled out of an upload, ready to convert. */
export interface DocxImportEntry {
  /** Slash-separated path inside the ZIP, or the bare file name. */
  path: string;
  bytes: ArrayBuffer;
}

const XML_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
};

/**
 * Decodes XML character references in one pass.
 *
 * A pass-per-entity decode (`&amp;` then `&lt;`) mangles escaped markup:
 * `&amp;lt;` would decode to `<` instead of the literal `&lt;` the document
 * actually contains. Matching every reference in a single scan keeps
 * already-decoded text from being decoded again.
 *
 * @param value - Raw text taken from an OOXML node.
 * @returns The text with `&amp;`, `&#39;`, `&#x2019;` and friends resolved.
 */
export function decodeXmlEntities(value: string): string {
  return value.replace(/&(#x[0-9a-fA-F]+|#\d+|[a-zA-Z]+);/g, (match, ref: string) => {
    if (ref.startsWith("#x") || ref.startsWith("#X")) {
      const code = Number.parseInt(ref.slice(2), 16);
      return Number.isFinite(code) ? String.fromCodePoint(code) : match;
    }
    if (ref.startsWith("#")) {
      const code = Number.parseInt(ref.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : match;
    }
    return XML_ENTITIES[ref.toLowerCase()] ?? match;
  });
}

/**
 * Escapes text for interpolation into HTML.
 *
 * @param value - Plain text.
 * @returns The text with HTML-significant characters escaped.
 */
export function escapeHtml(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!,
  );
}

/**
 * Reads the leading magic bytes of an upload.
 *
 * `.docx` is a ZIP (`PK\x03\x04`). The two common impostors are a legacy
 * Word 97 `.doc` and a password-protected export, both of which are OLE2
 * compound files (`D0 CF 11 E0`) that happen to carry a `.docx` name.
 * Naming that difference is the whole point of this check.
 *
 * @param bytes - Start of the uploaded file.
 * @returns The detected container format.
 */
export function detectFileSignature(
  bytes: ArrayBuffer,
): "empty" | "zip" | "ole" | "pdf" | "unknown" {
  const head = new Uint8Array(bytes.slice(0, 8));
  if (head.length === 0) return "empty";
  if (head[0] === 0x50 && head[1] === 0x4b) return "zip";
  if (
    head[0] === 0xd0 &&
    head[1] === 0xcf &&
    head[2] === 0x11 &&
    head[3] === 0xe0
  ) {
    return "ole";
  }
  if (head[0] === 0x25 && head[1] === 0x50 && head[2] === 0x44 && head[3] === 0x46) {
    return "pdf";
  }
  return "unknown";
}

/**
 * Whether a ZIP entry is a DOCX worth importing.
 *
 * Filters the debris every real-world archive carries: macOS `__MACOSX`
 * resource forks and their `._name.docx` twins (which are not DOCX files at
 * all and always fail to parse), Word's `~$` lock files, dotfiles, and
 * directory entries.
 *
 * @param name - Raw entry name from the archive.
 * @param isDirectory - Whether the archive marked the entry as a directory.
 * @returns `true` when the entry should be imported.
 */
export function isImportableDocxEntry(name: string, isDirectory = false): boolean {
  if (isDirectory) return false;
  if (!name.toLowerCase().endsWith(".docx")) return false;
  const segments = name.split("/").filter(Boolean);
  const base = segments.at(-1);
  if (!base) return false;
  if (segments.some((segment) => segment === "__MACOSX")) return false;
  if (base.startsWith("._") || base.startsWith(".") || base.startsWith("~$")) return false;
  return true;
}

/**
 * Normalizes a ZIP entry path into safe folder segments.
 *
 * Drops absolute-path roots, `.`/`..` traversal segments and drive letters, so
 * a hand-built archive cannot create folder rows named `..` in the library.
 *
 * @param name - Raw entry name from the archive.
 * @returns Slash-separated path with only meaningful segments.
 */
export function normalizeImportPath(name: string): string {
  return name
    .replace(/\\/g, "/")
    .split("/")
    .filter((segment) => segment && segment !== "." && segment !== ".." && !/^[a-zA-Z]:$/.test(segment))
    .join("/");
}

/** Word paragraph styles mapped to the heading level they represent. */
const HEADING_STYLE_PATTERN = /^(?:heading|berkeleyheading|h)\s*([1-6])$/i;

/**
 * Maps a `w:pStyle` value to the HTML block element it should render as.
 *
 * Verbatim's card structure (pocket / hat / block / tag) rides on Word heading
 * levels, so flattening every paragraph to `<p>` — as the previous importer
 * did — destroys the outline the card library is built around.
 *
 * @param styleId - Value of `w:pStyle`, or `undefined` for body text.
 * @returns The HTML tag name for the paragraph.
 */
export function paragraphTagForStyle(styleId: string | undefined): string {
  if (!styleId) return "p";
  const match = HEADING_STYLE_PATTERN.exec(styleId.replace(/[^a-zA-Z0-9]/g, ""));
  return match ? `h${match[1]}` : "p";
}

/** Extracts the inline formatting flags from a run's `w:rPr` block. */
function runFormatting(runXml: string) {
  const properties = /<w:rPr\b[^>]*>([\s\S]*?)<\/w:rPr>/.exec(runXml)?.[1] ?? "";
  const isOn = (tag: string) => {
    const match = new RegExp(`<w:${tag}\\b([^>]*)>`).exec(properties);
    if (!match) return false;
    const value = /w:val="([^"]*)"/.exec(match[1])?.[1];
    return value !== "none" && value !== "0" && value !== "false";
  };
  return { mark: isOn("highlight"), underline: isOn("u"), strong: isOn("b") };
}

/**
 * Converts the text of one `<w:r>` run to HTML, preserving highlighting.
 *
 * Highlighted and underlined spans *are* the evidence in a debate card, so
 * they are carried through as `<mark>`/`<u>` rather than flattened to plain
 * text. Tabs and line breaks inside a run are preserved too.
 */
function runToHtml(runXml: string): string {
  const pieces: string[] = [];
  const tokens =
    /<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>|<w:t\s*\/>|<w:tab\s*\/?>|<w:br\s*\/?>|<w:cr\s*\/?>/g;
  let token: RegExpExecArray | null;
  while ((token = tokens.exec(runXml)) !== null) {
    if (token[1] !== undefined) pieces.push(escapeHtml(decodeXmlEntities(token[1])));
    else if (token[0].startsWith("<w:tab")) pieces.push(" ");
    else pieces.push("<br />");
  }
  const text = pieces.join("");
  if (!text) return "";

  const { mark, underline, strong } = runFormatting(runXml);
  let html = text;
  if (strong) html = `<strong>${html}</strong>`;
  if (underline) html = `<u>${html}</u>`;
  if (mark) html = `<mark>${html}</mark>`;
  return html;
}

/**
 * Converts `word/document.xml` into card HTML.
 *
 * @param xml - Raw contents of `word/document.xml`.
 * @returns HTML for the document body, or `""` when it holds no text.
 */
export function documentXmlToHtml(xml: string): string {
  const paragraphs =
    xml.match(/<w:p(?:\s[^>]*)?\/>|<w:p(?:\s[^>]*)?>[\s\S]*?<\/w:p>/g) ?? [];

  const blocks: string[] = [];
  for (const paragraph of paragraphs) {
    const runs = paragraph.match(/<w:r(?:\s[^>]*)?>[\s\S]*?<\/w:r>/g) ?? [];
    const inner = runs.map(runToHtml).join("");
    // A paragraph of only breaks carries no evidence; drop it so imported
    // documents do not open with screens of blank lines.
    if (!inner.replace(/<br \/>/g, "").trim()) continue;
    const styleId = /<w:pStyle\b[^>]*w:val="([^"]*)"/.exec(paragraph)?.[1];
    const tag = paragraphTagForStyle(styleId);
    blocks.push(`<${tag}>${inner}</${tag}>`);
  }

  return blocks.join("");
}

/**
 * Opens a `.docx` and converts its body to HTML, or throws a coded reason.
 *
 * @param bytes - The DOCX file's bytes.
 * @returns HTML for the document body.
 * @throws {DocxImportError} When the file is not a readable, non-empty DOCX.
 */
export async function docxBytesToHtml(bytes: ArrayBuffer): Promise<string> {
  assertReadableDocxBytes(bytes);

  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(bytes);
  } catch (error) {
    throw new DocxImportError(
      "corrupt-zip",
      `The DOCX could not be opened — it looks truncated or corrupt (${(error as Error).message}). Re-save it from Word and upload again.`,
    );
  }

  const xml = await zip.file("word/document.xml")?.async("string");
  if (!xml) {
    const encrypted = zip.file("EncryptedPackage") ?? zip.file(/EncryptionInfo/)[0];
    if (encrypted) {
      throw new DocxImportError(
        "missing-document-xml",
        "The DOCX is password-protected. Remove the password in Word (File → Info → Protect Document) and upload again.",
      );
    }
    throw new DocxImportError(
      "missing-document-xml",
      "The file is a ZIP but not a Word document — it has no word/document.xml. Re-save it as .docx rather than renaming it.",
    );
  }

  const html = documentXmlToHtml(xml);
  if (!html) {
    throw new DocxImportError(
      "empty-document",
      "The DOCX opened but contains no text. Check that the content is not stored only in text boxes, images or a linked file.",
    );
  }
  return html;
}

/**
 * Rejects bytes that cannot be a DOCX, naming which impostor they are.
 *
 * @param bytes - The uploaded file's bytes.
 * @throws {DocxImportError} When the signature or size rules out a DOCX.
 */
export function assertReadableDocxBytes(bytes: ArrayBuffer): void {
  if (bytes.byteLength === 0) {
    throw new DocxImportError("empty-file", "The file is empty (0 bytes).");
  }
  if (bytes.byteLength > DOCX_IMPORT_LIMITS.maxFileBytes) {
    throw new DocxImportError(
      "too-large",
      `The file is ${formatBytes(bytes.byteLength)}, over the ${formatBytes(DOCX_IMPORT_LIMITS.maxFileBytes)} per-file limit.`,
    );
  }

  const signature = detectFileSignature(bytes);
  if (signature === "ole") {
    throw new DocxImportError(
      "legacy-doc",
      "This is a legacy .doc (or password-protected) Word file saved with a .docx name. Open it in Word and use Save As → Word Document (.docx).",
    );
  }
  if (signature === "pdf") {
    throw new DocxImportError(
      "not-a-zip",
      "This is a PDF renamed to .docx. Upload the original Word file instead.",
    );
  }
  if (signature !== "zip") {
    throw new DocxImportError(
      "not-a-zip",
      "This is not a Word document — the file does not start with a ZIP header. Re-save it as .docx rather than renaming it.",
    );
  }
}

/**
 * Collects the importable DOCX entries from an upload.
 *
 * A `.docx` upload yields itself; a `.zip` yields every DOCX inside it, minus
 * the archive debris {@link isImportableDocxEntry} filters out.
 *
 * @param fileName - Name of the uploaded file, used for the extension check.
 * @param bytes - The uploaded file's bytes.
 * @returns The DOCX entries to import, in archive order.
 * @throws {DocxImportError} When the upload holds no importable DOCX.
 */
export async function collectDocxEntries(
  fileName: string,
  bytes: ArrayBuffer,
): Promise<DocxImportEntry[]> {
  const name = fileName.toLowerCase();
  if (bytes.byteLength === 0) {
    throw new DocxImportError("empty-file", "The upload is empty (0 bytes).");
  }
  if (bytes.byteLength > DOCX_IMPORT_LIMITS.maxUploadBytes) {
    throw new DocxImportError(
      "too-large",
      `The upload is ${formatBytes(bytes.byteLength)}, over the ${formatBytes(DOCX_IMPORT_LIMITS.maxUploadBytes)} limit.`,
    );
  }

  if (name.endsWith(".docx")) {
    // Surface "this is really a .doc" before it becomes a per-file failure on
    // a batch of one, so the operator sees the real reason immediately.
    assertReadableDocxBytes(bytes);
    return [{ path: normalizeImportPath(fileName) || fileName, bytes }];
  }

  if (!name.endsWith(".zip")) {
    throw new DocxImportError(
      "unsupported-extension",
      "Only .docx and .zip uploads are supported.",
    );
  }

  if (detectFileSignature(bytes) !== "zip") {
    throw new DocxImportError(
      "not-a-zip",
      "The upload is named .zip but is not a ZIP archive.",
    );
  }

  let archive: JSZip;
  try {
    archive = await JSZip.loadAsync(bytes);
  } catch (error) {
    throw new DocxImportError(
      "corrupt-zip",
      `The ZIP could not be opened — it looks truncated or corrupt (${(error as Error).message}).`,
    );
  }

  const entries: DocxImportEntry[] = [];
  for (const entry of Object.values(archive.files)) {
    if (!isImportableDocxEntry(entry.name, entry.dir)) continue;
    entries.push({
      path: normalizeImportPath(entry.name) || entry.name,
      bytes: await entry.async("arraybuffer"),
    });
  }

  if (entries.length === 0) {
    const skipped = Object.values(archive.files).filter((entry) => !entry.dir).length;
    throw new DocxImportError(
      "no-docx-in-zip",
      skipped > 0
        ? `No DOCX files were found in that ZIP — its ${skipped} file${skipped === 1 ? "" : "s"} are all other formats, macOS resource forks, or Word lock files.`
        : "The ZIP is empty.",
    );
  }
  if (entries.length > DOCX_IMPORT_LIMITS.maxFiles) {
    throw new DocxImportError(
      "too-many-files",
      `The ZIP holds ${entries.length} DOCX files; uploads are limited to ${DOCX_IMPORT_LIMITS.maxFiles}. Split it into smaller archives.`,
    );
  }
  return entries;
}

/**
 * Turns any thrown value into a coded, operator-facing failure reason.
 *
 * @param error - The value a `catch` received.
 * @returns The failure's code and message.
 */
export function describeDocxImportError(error: unknown): {
  code: DocxImportErrorCode;
  reason: string;
} {
  if (error instanceof DocxImportError) return { code: error.code, reason: error.message };
  const message = error instanceof Error ? error.message : String(error);
  return {
    code: "unknown",
    reason: message ? `Unexpected import error: ${message}` : "Unexpected import error.",
  };
}

/**
 * Renders a byte count for an operator-facing message.
 *
 * @param bytes - A byte count.
 * @returns A short human-readable size such as `"2.4MB"`.
 */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

/**
 * Summarizes an import run for the admin UI.
 *
 * Reports partial success honestly — "17 imported, 3 failed" rather than a
 * bare success count that hides the files that never arrived.
 *
 * @param imported - Count of DOCX files that were stored.
 * @param failures - Per-file failures collected during the run.
 * @returns A one-line summary.
 */
export function summarizeImportOutcome(
  imported: number,
  failures: DocxImportFailure[],
): string {
  const files = (count: number) => `${count} DOCX file${count === 1 ? "" : "s"}`;
  if (failures.length === 0) return `Imported ${files(imported)}.`;
  if (imported === 0) return `Nothing imported — ${files(failures.length)} failed.`;
  return `Imported ${files(imported)}; ${failures.length} failed.`;
}
