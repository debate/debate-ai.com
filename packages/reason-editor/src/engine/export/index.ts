/**
 * Export public API: schema doc → .docx bytes.
 */

import type { Node as PMNode } from 'prosemirror-model';
import { Docx } from '../ooxml/docx.js';
import { exportDoc, type ExportOptions } from './exporter.js';

export { exportDoc } from './exporter.js';
export type { ExportResult, ExportOptions } from './exporter.js';

/**
 * Serialize a ProseMirror doc to a complete .docx byte buffer, ready
 * to write to disk or send across a wire. Image nodes contribute
 * media parts (binary writes under `word/media/`) tracked alongside
 * the document XML.
 *
 * Pass `opts.threads` to also emit `word/comments.xml` +
 * `word/commentsExtended.xml`; the doc's `comment_range` marks
 * become `<w:commentRangeStart/End>` brackets that Word reads as
 * thread anchors. Without `threads`, the comments parts are
 * omitted and the brackets are stripped from `document.xml`.
 */
export async function toDocx(doc: PMNode, opts: ExportOptions = {}): Promise<Uint8Array> {
  const result = exportDoc(doc, opts);
  const docx = Docx.empty();
  docx.writeText('word/document.xml', result.documentXml);
  docx.writeText('word/_rels/document.xml.rels', result.relsXml);
  for (const part of result.mediaParts) {
    docx.writeBinary(part.path, part.bytes);
  }
  if (result.commentsXml && result.commentsExtendedXml) {
    docx.writeText('word/comments.xml', result.commentsXml);
    docx.writeText('word/commentsExtended.xml', result.commentsExtendedXml);
    await docx.addContentTypeOverrides([
      {
        partName: '/word/comments.xml',
        contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.comments+xml',
      },
      {
        partName: '/word/commentsExtended.xml',
        contentType: 'application/vnd.ms-word.commentsExtended+xml',
      },
    ]);
  }
  // Stable per-document identity for the Learn annotation layer. Written
  // only when the caller supplies one, so doc-id-unaware callers (and the
  // round-trip tests) are unaffected.
  if (opts.docId) {
    await docx.writeDocId(opts.docId);
  }
  return docx.toBuffer();
}
