/**
 * bridge — lossless interchange between the live TipTap editor and the
 * headless CardMirror engine (.docx / .cmir).
 *
 * The editor and the engine use two *different* ProseMirror `Schema`
 * instances (TipTap builds its own from the extensions). But both
 * schemas share identical node/mark *names* and attribute keys — because
 * the editor's schema is generated from the very same specs the engine
 * uses (schema-extensions.ts). ProseMirror's JSON is keyed by name, so
 * `schema.nodeFromJSON(otherDoc.toJSON())` transcodes faithfully between
 * them, preserving every attribute including the opaque OOXML round-trip
 * data (rawTblPr/rawTcPr, spacing, ids, …). That makes ProseMirror JSON
 * the natural interchange:
 *
 *     .docx bytes ──fromDocx──▶ engine PMNode ──toJSON──▶ editor.setContent
 *     editor.getJSON ──nodeFromJSON──▶ engine PMNode ──toDocx──▶ .docx bytes
 *
 * The engine modules (jszip / fast-xml-parser / fflate) are heavy and
 * only needed on an explicit import/export action, so every function
 * here dynamically imports them — keeping them out of the editor's
 * initial bundle and the SSR path.
 */

import type { JSONContent } from '@tiptap/core';

/** ProseMirror doc JSON is structurally a TipTap `JSONContent`. */
type DocJSON = JSONContent;

/** Decode a .docx byte buffer into editor-ready doc JSON. */
export async function docxToDocJSON(bytes: Uint8Array): Promise<DocJSON> {
  const { fromDocx } = await import('../engine/import/index.js');
  const doc = await fromDocx(bytes);
  return doc.toJSON() as DocJSON;
}

/** Encode the editor's current doc JSON into .docx bytes. */
export async function docJSONToDocx(json: DocJSON): Promise<Uint8Array> {
  const [{ toDocx }, { schema }] = await Promise.all([
    import('../engine/export/index.js'),
    import('../engine/schema/index.js'),
  ]);
  const doc = schema.nodeFromJSON(json as unknown as Record<string, unknown>);
  return toDocx(doc);
}

/** Decode a .cmir (CardMirror native) byte buffer into editor doc JSON. */
export async function cmirToDocJSON(bytes: Uint8Array): Promise<DocJSON> {
  const { parseNative } = await import('../engine/native/index.js');
  return parseNative(bytes).doc.toJSON() as DocJSON;
}

/** Encode the editor's current doc JSON into .cmir bytes. */
export async function docJSONToCmir(json: DocJSON): Promise<Uint8Array> {
  const [{ serializeNative }, { schema }] = await Promise.all([
    import('../engine/native/index.js'),
    import('../engine/schema/index.js'),
  ]);
  const doc = schema.nodeFromJSON(json as unknown as Record<string, unknown>);
  return serializeNative(doc);
}

/** Browser helper: trigger a download of `bytes` as `filename`. */
export function downloadBytes(bytes: Uint8Array, filename: string, mime: string): void {
  if (typeof document === 'undefined') return;
  const view = new Uint8Array(bytes.byteLength);
  view.set(bytes);
  const blob = new Blob([view], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Revoke on the next tick so the click has a chance to start the
  // download before the object URL is invalidated.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

export const DOCX_MIME =
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
export const CMIR_MIME = 'application/octet-stream';
