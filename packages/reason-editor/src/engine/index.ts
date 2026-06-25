/**
 * Public API for the CardMirror engine (vendored).
 *
 * This is the headless, framework-agnostic core that powers
 * reason-editor: the ProseMirror schema (the debate-card document
 * model), the .docx <-> schema round-trip (Verbatim interop), and the
 * lossless .cmir native format. The React/TipTap shell in ../react
 * builds on top of this.
 *
 * Four layers:
 *   - Schema:   the ProseMirror schema (typed-tree document model).
 *   - Import:   .docx -> schema doc.
 *   - Export:   schema doc -> .docx.
 *   - Native:   schema doc <-> .cmir (lossless native file format).
 *
 * Adapted from cardmirror/src/index.ts. See THIRD-PARTY-NOTICES.md for
 * attribution and licensing.
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
  parseNative,
  looksLikeNative,
  NATIVE_FILE_EXTENSION,
} from './native/index.js';
export type {
  NativeFile,
  SerializeNativeOptions,
  ParseNativeResult,
} from './native/index.js';

export { Docx } from './ooxml/docx.js';

export { readDocIdFromBytes, stampDocId } from './docid.js';

// Comment thread model — surfaced so the React shell and host app can
// read/write comment threads alongside the document.
export type {
  Thread,
  Comment,
  CommentKind,
  CommentsState,
} from './comments-plugin.js';

export { normalizeUnderlineMarks } from './named-style-normalizer-plugin.js';
