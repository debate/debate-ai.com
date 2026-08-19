/**
 * Speech-document send target — pure data model + helpers for the "send
 * selected evidence to a speech document" command named as follow-up (b)
 * under idea #14 ("Legacy Verbatim / Cardmirror Compatibility") in
 * TODO.md's Product Feature Ideas list, closing the "Known gaps" note in
 * `docs/features/legacy-verbatim-shortcuts.md`: "it needs a
 * speech-document send target that doesn't exist yet in this repo."
 *
 * A `SpeechDocument` is a lightweight, ordered collection of evidence
 * blocks a debater has sent from a source document (a card, a research
 * note, a condensed read) toward the speech they're building — a staging
 * area, not a replacement for the full CardMirror document model or the
 * app's separate, DB-backed `/api/doc/documents` document store.
 */

export type SpeechDocumentBlock = {
  id: string;
  text: string;
  /** Where this block was sent from, e.g. the source editor's title. */
  sourceLabel?: string;
  addedAt: number;
};

export type SpeechDocument = {
  id: string;
  title: string;
  blocks: SpeechDocumentBlock[];
};

const DEFAULT_TITLE = "Untitled speech";

/** Creates a new, empty speech document with the given title (blank titles fall back to a default). */
export function createSpeechDocument(id: string, title: string): SpeechDocument {
  return { id, title: title.trim() || DEFAULT_TITLE, blocks: [] };
}

/**
 * Builds a block from a run of selected text, trimmed. Returns `null` for
 * blank/whitespace-only text so a caller can no-op instead of sending an
 * empty block (mirrors `formatShortCiteTag`'s "nothing to insert"
 * convention in `verbatim-shortcuts.ts`).
 */
export function buildSpeechDocumentBlock(
  id: string,
  text: string,
  addedAt: number,
  sourceLabel?: string,
): SpeechDocumentBlock | null {
  const trimmed = text.trim();
  if (!trimmed) return null;

  const trimmedLabel = sourceLabel?.trim();
  return {
    id,
    text: trimmed,
    addedAt,
    ...(trimmedLabel ? { sourceLabel: trimmedLabel } : {}),
  };
}

/** Appends a block to a document, returning a new document (pure). */
export function appendSpeechDocumentBlock(
  doc: SpeechDocument,
  block: SpeechDocumentBlock,
): SpeechDocument {
  return { ...doc, blocks: [...doc.blocks, block] };
}

/** Removes a block by id, returning a new document (pure); a no-op (by value) if the id isn't present. */
export function removeSpeechDocumentBlock(doc: SpeechDocument, blockId: string): SpeechDocument {
  return { ...doc, blocks: doc.blocks.filter((block) => block.id !== blockId) };
}

/**
 * Renders a document's blocks as plain, read-aloud text — each block
 * separated by a blank line, prefixed with its source label (in brackets)
 * when one was recorded.
 */
export function buildSpeechDocumentText(doc: SpeechDocument): string {
  return doc.blocks
    .map((block) => (block.sourceLabel ? `[${block.sourceLabel}] ${block.text}` : block.text))
    .join("\n\n");
}
