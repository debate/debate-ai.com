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

// Heading outline — derives H1-H4 structure from the flat heading
// paragraphs and computes collapse/expand ranges for a nav panel or
// editor view.
export {
  HEADING_LEVELS,
  buildHeadingOutline,
  getVisibleHeadingIds,
  getCollapsedRanges,
  isPositionCollapsed,
} from './outline/heading-outline.js';
export type {
  HeadingLevel,
  OutlineHeading,
  CollapsedRange,
} from './outline/heading-outline.js';

// Collapsed-heading persistence — stores which heading ids a document has
// collapsed, so a nav panel can restore collapse state across sessions.
export {
  listCollapsedHeadingSelections,
  getCollapsedHeadingSelection,
  saveCollapsedHeadingSelection,
  deleteCollapsedHeadingSelection,
} from '../state/collapsedHeadings.js';
export type { CollapsedHeadingSelection } from '../state/collapsedHeadings.js';

// Collapsed-heading decoration plugin — hides a collapsed heading's
// content in the live ProseMirror view (`OutlineNavPanel` drives this via
// `setCollapsedHeadingIdsMeta`).
export {
  collapsedHeadingsPlugin,
  collapsedHeadingsKey,
  setCollapsedHeadingIdsMeta,
  getCollapsedHeadingIds,
} from './outline/collapsed-headings-plugin.js';
export type { CollapsedHeadingsPluginState } from './outline/collapsed-headings-plugin.js';

// Comment thread model — surfaced so the React shell and host app can
// read/write comment threads alongside the document.
export type {
  Thread,
  Comment,
  CommentKind,
  CommentsState,
} from './comments-plugin.js';

export { normalizeUnderlineMarks } from './named-style-normalizer-plugin.js';

// Verbatim/Cardmirror compatibility shortcuts — condense-to-read-text and
// short-cite insertion, reusing `debate-card-parser`'s pure helpers
// against a live editor selection/document.
export {
  applyCondenseToHtml,
  buildInsertShortCiteTransaction,
} from './verbatim-shortcuts.js';

// Move-heading-section command — reorders a heading's whole section
// (heading through the next heading) up or down, reusing
// `debate-card-parser`'s generic `moveOutlineNode` to validate the swap.
export {
  buildMoveHeadingSectionTransaction,
  findHeadingAtPos,
} from './outline/heading-move.js';
