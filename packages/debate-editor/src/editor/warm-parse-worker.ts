/**
 * Web Worker that parses + extracts a palette file OFF the renderer
 * thread.
 *
 * The pin warm pass used to parse pinned files (gunzip + JSON + node
 * build for .cmir; a full Word import for .docx) synchronously on the
 * renderer main thread at idle+2s after boot — each large file a
 * multi-hundred-ms stall, landing exactly in the window where an
 * external window resize needs the renderer to relayout (the stale
 * stretched-frame symptom). The parse pipeline is DOM-free (fflate +
 * fast-xml-parser + ProseMirror model), so it runs here wholesale; the
 * doc travels back as ProseMirror JSON (a PMNode can't cross a worker
 * boundary) and the caller materializes it only when actually needed —
 * warming stores the JSON, a real dive pays one fromJSON.
 *
 * Protocol: { id, bytes, format, kinds } →
 *   { id, ok: true, docJson, objects, outline } | { id, ok: false, error }
 */

import { parseNative } from '../native/index.js';
import { fromDocx } from '../import/index.js';
import { extractFile, type FileObjectKind } from './file-search.js';

interface ParseRequest {
  id: number;
  bytes: Uint8Array;
  format: 'cmir' | 'docx';
  kinds: FileObjectKind[];
}

const post = (message: unknown): void =>
  (self as unknown as { postMessage(m: unknown): void }).postMessage(message);

self.onmessage = (e: MessageEvent): void => {
  const req = e.data as ParseRequest | null;
  if (!req || typeof req.id !== 'number') return;
  void (async () => {
    try {
      const doc =
        req.format === 'docx' ? await fromDocx(req.bytes) : parseNative(req.bytes).doc;
      const { objects, outline } = extractFile(doc, new Set(req.kinds));
      post({ id: req.id, ok: true, docJson: doc.toJSON(), objects, outline });
    } catch (err) {
      post({ id: req.id, ok: false, error: err instanceof Error ? err.message : String(err) });
    }
  })();
};
