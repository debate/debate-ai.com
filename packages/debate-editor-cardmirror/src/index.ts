/**
 * Public API for CardMirror.
 *
 * Four layers:
 *   - Schema:   the ProseMirror schema (typed-tree document model).
 *   - Import:   .docx → schema doc.
 *   - Export:   schema doc → .docx.
 *   - Native:   schema doc ↔ .cmir (CardMirror's lossless native
 *               file format, no Verbatim round-trip).
 */

export {
  schema,
  nodes,
  marks,
  newHeadingId,
  bookmarkNameForId,
  idFromBookmarkName,
  HEADING_BOOKMARK_PREFIX,
} from './schema/index.js';

export { fromDocx, fromDocxFull, importDoc, importComments } from './import/index.js';

export { toDocx, exportDoc } from './export/index.js';
export type { ExportResult, ExportOptions } from './export/index.js';

export {
  serializeNative,
  serializeNativeAsync,
  parseNative,
  parseNativeSalvage,
  NativeDamagedError,
  looksLikeNative,
  setSaveHealListener,
  NATIVE_FILE_EXTENSION,
} from './native/index.js';
export type { DroppedNode } from './schema/salvage.js';
export type {
  NativeFile,
  SerializeNativeOptions,
  ParseNativeResult,
  SaveHealReport,
} from './native/index.js';

export { Docx } from './ooxml/docx.js';

export { readDocIdFromBytes, stampDocId } from './docid.js';
