/**
 * Read or stamp a document's stable `docId` (the Learn annotation key)
 * directly on a file's bytes — without re-rendering its content.
 *
 *   - `.docx`: load the zip, add the custom document property, re-zip.
 *     All other parts (document.xml, styles, media, …) are preserved, so
 *     this is lossless — unlike a parse → `toDocx` round-trip.
 *   - `.cmir`: a minimal JSON field edit.
 *
 * Used when linking a flashcard to a file that has no identity yet, so a
 * future open of that file re-associates with the same cards.
 */

import { Docx } from './ooxml/docx.js';
import { gzip, gunzip, isGzip } from './native/codec.js';

/** Read a file's existing docId, or null if it has none. Cheap — for
 *  `.docx` it only inspects the custom-properties part. */
export async function readDocIdFromBytes(
  bytes: Uint8Array,
  format: 'cmir' | 'docx',
): Promise<string | null> {
  if (format === 'docx') {
    try {
      return await (await Docx.load(bytes)).readDocId();
    } catch {
      return null;
    }
  }
  try {
    const raw = isGzip(bytes) ? gunzip(bytes) : bytes;
    const obj = JSON.parse(new TextDecoder().decode(raw)) as { docId?: unknown };
    return typeof obj.docId === 'string' && obj.docId ? obj.docId : null;
  } catch {
    return null;
  }
}

/** Return a copy of `bytes` with `docId` embedded, preserving everything
 *  else. Throws if the bytes aren't a readable file of the given format. */
export async function stampDocId(
  bytes: Uint8Array,
  format: 'cmir' | 'docx',
  docId: string,
): Promise<Uint8Array> {
  if (format === 'docx') {
    const docx = await Docx.load(bytes);
    await docx.writeDocId(docId);
    return docx.toBuffer();
  }
  // Mirror the input's format: a compressed file stays compressed, a
  // plaintext file stays plaintext (stamping a docId shouldn't itself flip
  // a file's container format — a full save does that).
  const wasGzip = isGzip(bytes);
  const raw = wasGzip ? gunzip(bytes) : bytes;
  const obj = JSON.parse(new TextDecoder().decode(raw)) as Record<string, unknown>;
  obj['docId'] = docId;
  const out = new TextEncoder().encode(JSON.stringify(obj));
  return wasGzip ? gzip(out) : out;
}
