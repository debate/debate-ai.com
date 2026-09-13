/**
 * @fileoverview Walks a downloaded openCaselist bulk `.zip` into per-document
 * card HTML, with the school, team and side each file came from.
 *
 * The conversion itself is not reimplemented here: `debate-card-parser` owns
 * DOCX → HTML → cards for every other path a `.docx` enters the app by
 * (the editor's import, the admin uploader), and a second implementation would
 * drift from it. What this module owns is the part that is specific to a bulk
 * caselist archive rather than to one upload:
 *
 * - **Scale.** `collectDocxEntries` buffers every entry's bytes at once, which
 *   is right for a human dragging files into the browser and wrong for a
 *   season dump — `hspolicy26-all-*.zip` is thousands of documents and
 *   hundreds of megabytes. Entries here are decompressed and converted one at
 *   a time and handed straight to {@link LoadArchiveOptions.onDocument}, so an
 *   ingest holds one document in memory, not an archive.
 * - **Provenance.** A file's path inside the archive is the only record of
 *   whose evidence it is. {@link describeCaselistEntry} reads it back out.
 * - **Partial failure.** One password-protected or truncated `.docx` in a
 *   3,000-file archive must not fail the run; every failure is collected and
 *   reported with the same coded reasons the interactive importer uses.
 *
 * @module caselist/caselist-archive
 */
import JSZip from "jszip";
import {
  type Card,
  type OutlineNode,
  type ParseMetadata,
  describeDocxImportError,
  docxBytesToHtml,
  htmlToCards,
  isImportableDocxEntry,
  normalizeImportPath,
} from "debate-card-parser";

/** Which side of the resolution a file is evidence for. */
export type CaselistSide = "Aff" | "Neg" | null;

/** What a file's path inside the archive says about where it came from. */
export interface CaselistEntryInfo {
  /** Path inside the archive, slash-separated. */
  path: string;
  /** File name with its extension. */
  fileName: string;
  /** School folder, e.g. `Glenbrook North`. `null` for a loose file. */
  school: string | null;
  /** Team folder under the school, e.g. `Chen-Patel`. `null` when absent. */
  team: string | null;
  /** Side, when the path or file name names one. */
  side: CaselistSide;
}

/** One converted document out of an archive. */
export interface CaselistDocument extends CaselistEntryInfo {
  /** Card HTML produced by `debate-card-parser`. */
  html: string;
  /** Parsed cards, when {@link LoadArchiveOptions.parseCards} is on. */
  cards?: Card[];
  /** The parser's file-level metadata, alongside `cards`. */
  metadata?: ParseMetadata;
}

/** One document in an archive that could not be converted. */
export interface CaselistDocumentFailure {
  path: string;
  code: string;
  reason: string;
}

/** Result of walking one archive. */
export interface CaselistArchiveLoad {
  /** Converted documents. Empty when a streaming `onDocument` consumed them. */
  documents: CaselistDocument[];
  failures: CaselistDocumentFailure[];
  /** Importable `.docx` entries found, whether or not they converted. */
  entryCount: number;
  /** Entries converted successfully. */
  importedCount: number;
}

/** Options for {@link loadCaselistArchive}. */
export interface LoadArchiveOptions {
  /**
   * Called with each document as it converts. Returning a promise backpressures
   * the walk, so a consumer that writes to a database sets the pace instead of
   * the decompressor.
   *
   * When set, documents are not also accumulated in the result.
   */
  onDocument?: (document: CaselistDocument) => void | Promise<void>;
  /** Stop after this many converted documents. Unlimited when omitted. */
  limit?: number;
  /** Also run `htmlToCards` on each document. Off by default — it is the
   *  expensive half, and an ingest that only needs HTML should not pay it. */
  parseCards?: boolean;
  /** Caselist slug, stripped from the head of entry paths when present. */
  slug?: string;
}

/**
 * Distinguishes a finished card from an outline heading.
 *
 * `htmlToCards` returns one flat outline of both; only a card carries a
 * `summary`, which is the same discriminator the parser's own callers use.
 *
 * @param node - A node from a parse result's outline.
 * @returns Whether the node is a card.
 */
function isCardNode(node: OutlineNode): node is Card {
  return "summary" in node;
}

const SIDE_PATTERNS: readonly { pattern: RegExp; side: Exclude<CaselistSide, null> }[] = [
  { pattern: /\b(aff|affirmative|1ac|2ac)\b/i, side: "Aff" },
  { pattern: /\b(neg|negative|1nc|2nr)\b/i, side: "Neg" },
];

/**
 * Reads provenance out of an entry's path.
 *
 * openCaselist lays an archive out as `{school}/{team}/{file}.docx`, sometimes
 * under a leading caselist folder, and names the side in the file name
 * (`… Aff.docx`, `1AC …`). Every part of that is best-effort: a school that
 * posts loose files, or a team folder that is really a tournament folder, must
 * degrade to `null` rather than to a wrong attribution, because these values
 * are what an ingested card is later credited to.
 *
 * @param path - Entry path inside the archive.
 * @param slug - Caselist slug to strip from the head of the path, if present.
 * @returns The path's school, team, side and file name.
 */
export function describeCaselistEntry(path: string, slug?: string): CaselistEntryInfo {
  const normalized = normalizeImportPath(path) || String(path);
  const segments = normalized.split("/").filter(Boolean);
  if (slug && segments[0]?.toLowerCase() === slug.toLowerCase()) segments.shift();

  const fileName = segments.pop() ?? normalized;
  const [school = null, team = null] = segments;

  // Read the side off the file name first: a team folder named "Aff-Neg" or a
  // school called "Negaunee" would otherwise decide it.
  const haystacks = [fileName, ...segments];
  let side: CaselistSide = null;
  for (const haystack of haystacks) {
    const hit = SIDE_PATTERNS.find((candidate) => candidate.pattern.test(haystack));
    if (hit) {
      side = hit.side;
      break;
    }
  }

  return { path: normalized, fileName, school, team, side };
}

/**
 * Walks a bulk archive, converting every `.docx` it holds.
 *
 * @param bytes - The downloaded `.zip`.
 * @param options - Streaming, limit, card-parsing and slug options.
 * @returns Counts, failures, and the documents when not streamed.
 * @throws When the bytes are not a readable ZIP at all — a corrupt download is
 *   a run-level failure, unlike a corrupt document inside a good archive.
 */
export async function loadCaselistArchive(
  bytes: ArrayBuffer | Uint8Array,
  options: LoadArchiveOptions = {},
): Promise<CaselistArchiveLoad> {
  let archive: JSZip;
  try {
    archive = await JSZip.loadAsync(bytes);
  } catch (error) {
    throw new Error(
      `The archive could not be opened — it looks truncated or corrupt (${(error as Error).message}). Re-download it and try again.`,
    );
  }

  const entries = Object.values(archive.files).filter((entry) =>
    isImportableDocxEntry(entry.name, entry.dir),
  );

  const documents: CaselistDocument[] = [];
  const failures: CaselistDocumentFailure[] = [];
  let importedCount = 0;

  for (const entry of entries) {
    if (options.limit !== undefined && importedCount >= options.limit) break;

    const info = describeCaselistEntry(entry.name, options.slug);
    let document: CaselistDocument;
    try {
      const entryBytes = await entry.async("arraybuffer");
      const html = await docxBytesToHtml(entryBytes);
      document = { ...info, html };
      if (options.parseCards) {
        const parsed = htmlToCards(html, info.fileName);
        document.cards = parsed.outline.filter(isCardNode);
        document.metadata = parsed.metadata;
      }
    } catch (error) {
      // One unreadable document is data, not an outage: record why and keep
      // walking, so a run's report names the files to chase rather than
      // stopping the other 2,999.
      const described = describeDocxImportError(error);
      failures.push({ path: info.path, code: described.code, reason: described.reason });
      continue;
    }

    importedCount += 1;
    if (options.onDocument) await options.onDocument(document);
    else documents.push(document);
  }

  return { documents, failures, entryCount: entries.length, importedCount };
}
