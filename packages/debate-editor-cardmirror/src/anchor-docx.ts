/**
 * Surgical heading-anchor injection for `.docx` source files.
 *
 * A live zone re-locates its section on refresh by a stable heading id. A
 * `.cmir` carries that id natively; a `.docx` only does if it holds a
 * `pmd-heading-<uuid>` Word bookmark on the heading paragraph. CardMirror's
 * exporter writes those bookmarks, but a raw Word / Verbatim file has none, so
 * refresh from one can never re-find the section (TRANSCLUSION §.docx-sources).
 *
 * This module makes a raw `.docx` trackable by injecting a SINGLE bookmark
 * around the ONE paragraph being transcluded — additively, without
 * re-serializing the whole document (that would round-trip arbitrary Word
 * content through our debate-focused schema and mangle it). The edit is
 * `Docx.load` → splice two elements into `word/document.xml` → `toBuffer`, the
 * same lossless load-one-part-swap pattern proven by `stampDocId` in
 * `src/docid.ts`. Every other part, and every untouched paragraph, is preserved.
 *
 * It is idempotent (an existing `pmd-heading` bookmark is reused, no write) and
 * fail-safe (the located paragraph's text is cross-checked against the heading;
 * a mismatch aborts rather than bookmarking the wrong section). Pure — only
 * fflate + fast-xml-parser — so it runs renderer-side (where all docx logic
 * lives) and is unit-tested in isolation.
 */

import { Docx } from './ooxml/docx.js';
import {
  parseXml,
  serializeXmlNodes,
  findChild,
  children,
  attrs,
  textContent,
  bodyParagraphsInOrder,
  type XmlNode,
} from './ooxml/parse.js';
import {
  bookmarkNameForId,
  idFromBookmarkName,
  HEADING_BOOKMARK_PREFIX,
} from './schema/ids.js';

export type AnchorOutcome =
  | {
      ok: true;
      /** The `.docx` bytes to persist. Equal to the input (by reference) when
       *  `added` is false — nothing needs writing. */
      bytes: Uint8Array;
      /** The heading id now anchored in the file — an EXISTING bookmark's id
       *  when `added` is false, otherwise `desiredId`. Store this as the zone's
       *  `source_heading_id`. */
      headingId: string;
      /** True when a new bookmark was inserted (the file must be written back).
       *  False when the paragraph was already anchored (no write needed). */
      added: boolean;
    }
  | {
      ok: false;
      reason:
        | 'parse-failed'
        /** No paragraph at `srcPara` — the file changed, or provenance is stale. */
        | 'paragraph-not-found'
        /** The paragraph at `srcPara` isn't the expected heading — refuse to
         *  bookmark the wrong section. */
        | 'text-mismatch';
    };

/** Collapse runs of whitespace and trim, so a run-split Word paragraph and a
 *  ProseMirror `textContent` compare equal on content alone. */
function normalizeText(s: string): string {
  return s.replace(/\s+/g, ' ').trim();
}

/** The id of an existing `pmd-heading` bookmark on this `<w:p>`, or null. */
function existingHeadingBookmark(pChildren: XmlNode[]): string | null {
  for (const c of pChildren) {
    if ('w:bookmarkStart' in c) {
      const name = attrs(c)['w:name'];
      if (name) {
        const id = idFromBookmarkName(name);
        if (id) return id;
      }
    }
  }
  return null;
}

/** Lowest `w:id` not already used anywhere in `documentXml` (bookmarks,
 *  comments, revisions all share the attribute; a globally-fresh number is
 *  safe for the start/end pair). */
function nextBookmarkId(documentXml: string): number {
  let max = -1;
  for (const m of documentXml.matchAll(/\bw:id="(\d+)"/g)) {
    const n = Number(m[1]);
    if (Number.isFinite(n) && n > max) max = n;
  }
  return max + 1;
}

/**
 * Ensure the paragraph at body-order index `srcPara` in `docxBytes` carries a
 * `pmd-heading` bookmark so a live zone can re-locate it on refresh.
 *
 * @param srcPara      0-based index from the importer's provenance map (built
 *                     with `bodyParagraphsInOrder`, which this re-uses — the two
 *                     always agree on which paragraph is the Nth).
 * @param desiredId    the heading id to bookmark with when inserting anew
 *                     (typically the id the import already gave the heading).
 * @param expectedText the heading's text, cross-checked against the located
 *                     paragraph as a corruption guard.
 */
export async function ensureHeadingAnchor(
  docxBytes: Uint8Array,
  srcPara: number,
  desiredId: string,
  expectedText: string,
): Promise<AnchorOutcome> {
  let docx: Docx;
  let documentXml: string | null;
  try {
    docx = await Docx.load(docxBytes);
    documentXml = await docx.readText('word/document.xml');
  } catch {
    return { ok: false, reason: 'parse-failed' };
  }
  if (!documentXml) return { ok: false, reason: 'parse-failed' };

  let tree: XmlNode[];
  try {
    tree = parseXml(documentXml);
  } catch {
    return { ok: false, reason: 'parse-failed' };
  }
  const docEl = findChild(tree, 'w:document');
  if (!docEl) return { ok: false, reason: 'parse-failed' };
  const body = findChild(children(docEl, 'w:document'), 'w:body');
  if (!body) return { ok: false, reason: 'parse-failed' };

  const target = bodyParagraphsInOrder(children(body, 'w:body'))[srcPara];
  if (!target) return { ok: false, reason: 'paragraph-not-found' };
  const kids = target['w:p'];
  if (!Array.isArray(kids)) return { ok: false, reason: 'paragraph-not-found' };

  // Corruption guard: only bookmark this paragraph if it really is the heading.
  const wanted = normalizeText(expectedText);
  if (wanted && normalizeText(textContent(target)) !== wanted) {
    return { ok: false, reason: 'text-mismatch' };
  }

  // Idempotent: a paragraph already anchored (e.g. a CardMirror-exported .docx)
  // needs no write — reuse its id, return the original bytes.
  const existing = existingHeadingBookmark(kids);
  if (existing) return { ok: true, bytes: docxBytes, headingId: existing, added: false };

  // Insert `<w:bookmarkStart .../>` right after `<w:pPr>` (or at the paragraph
  // start when there is none), and `<w:bookmarkEnd/>` at the very end — the same
  // bracketing the exporter emits (src/export/exporter.ts).
  const wId = String(nextBookmarkId(documentXml));
  // XmlNode's index signature makes it awkward to construct literally (the `:@`
  // attr bag conflicts with `[tag]: XmlNode[] | string`); the parser is the only
  // other producer. Build the shape the serializer expects and cast via unknown.
  const startNode = {
    'w:bookmarkStart': [],
    ':@': { 'w:id': wId, 'w:name': bookmarkNameForId(desiredId) },
  } as unknown as XmlNode;
  const endNode = { 'w:bookmarkEnd': [], ':@': { 'w:id': wId } } as unknown as XmlNode;
  const pPrIdx = kids.findIndex((k) => 'w:pPr' in k);
  kids.splice(pPrIdx >= 0 ? pPrIdx + 1 : 0, 0, startNode);
  kids.push(endNode);

  // Re-serialize ONLY the <w:document> subtree and keep the original prolog
  // verbatim (serializeXmlNodes would turn the `<?xml?>` declaration into a
  // bogus self-closing tag).
  const prolog = documentXml.slice(0, documentXml.indexOf('<w:document'));
  const newXml = prolog + serializeXmlNodes([docEl]);

  let bytes: Uint8Array;
  try {
    docx.writeText('word/document.xml', newXml);
    bytes = await docx.toBuffer();
  } catch {
    return { ok: false, reason: 'parse-failed' };
  }

  // Self-check: the re-zipped file must re-parse and the target paragraph must
  // now resolve to `desiredId`. Catches any serialization mishap BEFORE we hand
  // the bytes to be written over the user's (possibly shared) source file.
  if (!(await verifyAnchor(bytes, srcPara, desiredId))) {
    return { ok: false, reason: 'parse-failed' };
  }
  return { ok: true, bytes, headingId: desiredId, added: true };
}

/** Reload the produced bytes and confirm paragraph `srcPara` now carries the
 *  `pmd-heading-<expectedId>` bookmark (validates zip + XML + placement). */
async function verifyAnchor(
  bytes: Uint8Array,
  srcPara: number,
  expectedId: string,
): Promise<boolean> {
  try {
    const docx = await Docx.load(bytes);
    const xml = await docx.readText('word/document.xml');
    if (!xml) return false;
    const docEl = findChild(parseXml(xml), 'w:document');
    if (!docEl) return false;
    const body = findChild(children(docEl, 'w:document'), 'w:body');
    if (!body) return false;
    const target = bodyParagraphsInOrder(children(body, 'w:body'))[srcPara];
    if (!target || !Array.isArray(target['w:p'])) return false;
    return existingHeadingBookmark(target['w:p']) === expectedId;
  } catch {
    return false;
  }
}
