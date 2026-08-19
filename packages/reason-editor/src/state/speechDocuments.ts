/**
 * @fileoverview Persistent storage for `speech-document.ts`'s
 * `SpeechDocument` records — the send target for the "send selected
 * evidence to a speech document" command named as follow-up (b) under
 * idea #14 ("Legacy Verbatim / Cardmirror Compatibility") in TODO.md's
 * Product Feature Ideas list. Stores documents in localStorage, mirroring
 * the existing `collapsedHeadings.ts` persistence convention (the first
 * such store in this package).
 *
 * @module state/speechDocuments
 */

import type { SpeechDocument, SpeechDocumentBlock } from "../engine/speech-document.js";
import {
  appendSpeechDocumentBlock,
  buildSpeechDocumentBlock,
  createSpeechDocument,
} from "../engine/speech-document.js";

const STORAGE_KEY = "reasonEditorSpeechDocuments";

function readAll(): SpeechDocument[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as SpeechDocument[]) : [];
  } catch {
    return [];
  }
}

function writeAll(documents: SpeechDocument[]): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(documents));
}

/** Lists every persisted speech document. */
export function listSpeechDocuments(): SpeechDocument[] {
  return readAll();
}

/** Looks up a single persisted speech document by id, if any. */
export function getSpeechDocument(id: string): SpeechDocument | undefined {
  return readAll().find((doc) => doc.id === id);
}

/** Finds a persisted speech document by title, case-insensitively (the "existing or new" send target lookup). */
export function findSpeechDocumentByTitle(title: string): SpeechDocument | undefined {
  const normalized = title.trim().toLowerCase();
  return readAll().find((doc) => doc.title.trim().toLowerCase() === normalized);
}

/** Saves a speech document, overwriting any existing record with the same id. */
export function saveSpeechDocument(doc: SpeechDocument): void {
  const documents = readAll();
  const index = documents.findIndex((existing) => existing.id === doc.id);
  if (index === -1) {
    documents.push(doc);
  } else {
    documents[index] = doc;
  }
  writeAll(documents);
}

/** Deletes a persisted speech document by id; a no-op if it isn't stored. */
export function deleteSpeechDocument(id: string): void {
  writeAll(readAll().filter((doc) => doc.id !== id));
}

/** Removes a single block from a persisted speech document and saves the result; a no-op if the document isn't stored. */
export function removeSpeechDocumentBlockAndSave(docId: string, blockId: string): SpeechDocument | undefined {
  const doc = getSpeechDocument(docId);
  if (!doc) return undefined;
  const updated: SpeechDocument = { ...doc, blocks: doc.blocks.filter((block) => block.id !== blockId) };
  saveSpeechDocument(updated);
  return updated;
}

/**
 * Sends a run of selected text to a speech document, finding an existing
 * document with a matching title (case-insensitive) or creating one.
 * Returns the updated document, or `null` when the text was blank — no
 * document is created or touched for a no-op selection.
 */
export function sendSelectionToSpeechDocument(
  title: string,
  text: string,
  sourceLabel: string | undefined,
  idFactory: () => string,
  now: number,
): SpeechDocument | null {
  const block: SpeechDocumentBlock | null = buildSpeechDocumentBlock(idFactory(), text, now, sourceLabel);
  if (!block) return null;

  const existing = findSpeechDocumentByTitle(title);
  const target = existing ?? createSpeechDocument(idFactory(), title);
  const updated = appendSpeechDocumentBlock(target, block);
  saveSpeechDocument(updated);
  return updated;
}
