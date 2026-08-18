/**
 * @fileoverview Persistent storage for a document's collapsed heading ids,
 * keyed by `documentId` — the "(c) persisting collapsed-state per document"
 * follow-up named under idea #9 ("Expandable Heading Structure") in
 * TODO.md's Product Feature Ideas list. Stores selections in localStorage,
 * mirroring the existing `debate-round` `argumentTreeFilters.ts`/
 * `debate-speech-writer` `judgeParadigmSelections.ts` persistence
 * convention. This is the first localStorage-backed persistence store in
 * the `reason-editor` package.
 *
 * @module state/collapsedHeadings
 */

export type CollapsedHeadingSelection = {
  documentId: string;
  collapsedIds: string[];
};

const STORAGE_KEY = "reasonEditorCollapsedHeadings";

function readAll(): CollapsedHeadingSelection[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as CollapsedHeadingSelection[]) : [];
  } catch {
    return [];
  }
}

function writeAll(selections: CollapsedHeadingSelection[]): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(selections));
}

/** Lists every persisted collapsed-heading selection. */
export function listCollapsedHeadingSelections(): CollapsedHeadingSelection[] {
  return readAll();
}

/** Looks up the persisted collapsed-heading selection for a document, if any. */
export function getCollapsedHeadingSelection(
  documentId: string,
): CollapsedHeadingSelection | undefined {
  return readAll().find((selection) => selection.documentId === documentId);
}

/** Saves a document's collapsed-heading selection, overwriting any existing selection for that `documentId`. */
export function saveCollapsedHeadingSelection(selection: CollapsedHeadingSelection): void {
  const selections = readAll();
  const index = selections.findIndex(
    (existing) => existing.documentId === selection.documentId,
  );
  if (index === -1) {
    selections.push(selection);
  } else {
    selections[index] = selection;
  }
  writeAll(selections);
}

/** Deletes a document's persisted collapsed-heading selection; a no-op if it isn't stored. */
export function deleteCollapsedHeadingSelection(documentId: string): void {
  writeAll(readAll().filter((selection) => selection.documentId !== documentId));
}
