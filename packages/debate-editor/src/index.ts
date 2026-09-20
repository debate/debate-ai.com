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

// Headless .docx → .cmir conversion (no DOM, no host): the server-side half
// of the desktop bulk converter, used by debate-ai.com's admin importer so
// every uploaded file lands in the library as a CardMirror native file.
export {
  docxToCmir,
  cmirToBase64,
  base64ToCmir,
  looksLikeCmirBase64,
} from './native/convert.js';
export type { DocxToCmirResult, DocxToCmirOptions } from './native/convert.js';

export { Docx } from './ooxml/docx.js';

export { readDocIdFromBytes, stampDocId } from './docid.js';

// Speech-send log — history of what has landed in the designated speech
// doc via `sendToSpeech` (see `editor/speech-doc-send.ts`). No ProseMirror
// or React in this module, so it's safe for a plain page component (e.g.
// `/speech-documents`) to import through this headless entry point rather
// than the full editor bundle.
export {
  speechSendLogStore,
  buildSpeechSendLogEntry,
  buildSpeechSendPreview,
  appendSpeechSendLogEntry,
  removeSpeechSendLogEntry,
  sanitizeSpeechSendLog,
  isValidSpeechSendLogEntry,
  MAX_SPEECH_SEND_LOG_ENTRIES,
  MAX_SAVED_SPEECH_SEND_LOG_BYTES,
} from './editor/speech-send-log.js';
export type { SpeechSendLogEntry } from './editor/speech-send-log.js';

// Quick Cards — account-sync validation, shared by the store itself and by
// `apps/debate-ai.com`'s `/api/quick-cards` routes (see
// `quick-cards-store.ts`'s "Account sync" module-doc section).
export { isValidQuickCardRecord, MAX_SAVED_QUICK_CARD_BYTES } from './editor/quick-cards-store.js';
export type { QuickCard } from './editor/quick-cards-store.js';

// Learn flashcard-content account-sync validation, shared by the store
// itself and by `apps/debate-ai.com`'s `/api/learn-cards` routes (see
// `learn-cards-sync.ts`'s module doc).
export { isValidLearnCardRecord, MAX_SAVED_LEARN_CARD_BYTES } from './editor/learn-store.js';
export type { CardDef } from './editor/learn-store.js';

// Learn custom-deck account-sync validation, shared by the store itself and
// by `apps/debate-ai.com`'s `/api/learn-decks` routes (see
// `learn-decks-sync.ts`'s module doc).
export { isValidLearnDeckRecord, MAX_SAVED_LEARN_DECK_BYTES } from './editor/learn-store.js';
export type { CustomDeck } from './editor/learn-store.js';

// Per-deck add-card/remove-card/rename ops, resolved server-side against a
// deck's current stored state — the fix for the "two devices edit the same
// deck at once" lost-update race a whole-deck `PUT` is exposed to (see
// `learn-deck-op.ts`'s module doc and `/api/learn-decks/[deckId]`'s `PATCH`
// handler).
export { normalizeLearnDeckOpPatch, applyLearnDeckOp } from './editor/learn-deck-op.js';
export type { LearnDeckOp } from './editor/learn-deck-op.js';
