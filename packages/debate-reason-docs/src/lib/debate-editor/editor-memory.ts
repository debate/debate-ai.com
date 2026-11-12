/**
 * @fileoverview Freeing the editor state Debate Editor keeps for a document
 * that is off screen — what suspending an editor tab
 * (`lib/reason-docs/tab-suspension.ts`) does inside the editor.
 *
 * The editor is loaded on demand rather than imported: `ReasonDocsProvider`
 * wraps every page, and the package root ships the React editor shell. Only
 * a page that mounted the editor has state to free, and there the module is
 * already loaded, so the import resolves at once.
 *
 * @module lib/debate-editor/editor-memory
 */

/** Drops the saved `EditorState` (doc, undo history) Debate Editor holds for
 *  `contentKey`. Fire and forget; never throws. */
export function discardEditorState(contentKey: string): void {
  void import("@debate-ai/editor")
    .then((editor) => editor.discardSavedState(contentKey))
    .catch(() => {
      // Nothing loaded means nothing kept.
    })
}
