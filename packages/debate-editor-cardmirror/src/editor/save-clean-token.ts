/**
 * Clean-token — guards the post-save "mark clean" commit against edits
 * that land while the save's serialize/write is in flight.
 *
 * Every save is async: snapshot the doc, serialize (possibly slow —
 * toDocx on a big file), await the disk write. Keystrokes made during
 * that window are NOT in the written bytes, but the completion handlers
 * used to clear the dirty flag unconditionally — so a close within the
 * next autosave debounce skipped the save prompt AND dropped the
 * recovery journal, silently losing those keystrokes.
 *
 * The fix: capture the doc's edit generation right before serializing;
 * on completion, only mark clean (and only clear the crash-recovery
 * journal) if the generation hasn't moved. A moved generation means
 * newer edits exist → the doc stays dirty and the journal stays put;
 * the already-armed autosave/journal debounces will flush them.
 *
 * Both layouts adapt to `CleanTokenTarget`: single-doc over its module
 * globals, multi-pane over the focused `DocRecord`. Targets must bump
 * their generation on every doc-changing edit AND on doc swaps (Open /
 * New / recovery replacing the single-doc content), so a token captured
 * for the old doc can never mark its replacement clean.
 */

export interface CleanTokenTarget {
  /** Current edit generation — bumped on every doc-changing edit (and,
   *  single-doc, on doc swaps). */
  editGen(): number;
  /** Clear the dirty flag. Must NOT bump the generation — several saves
   *  can be in flight for the same generation (autosave + manual ⌘S)
   *  and each of their commits should succeed. */
  markClean(): void;
  /** Drop the doc's crash-recovery journal (best-effort, fire-and-forget). */
  clearJournal(): void;
}

/** Capture the target's generation NOW (call immediately before
 *  serializing); the returned commit fn marks clean + clears the
 *  journal only if no edits landed since, and reports whether it did. */
export function captureCleanToken(target: CleanTokenTarget): () => boolean {
  const gen = target.editGen();
  return (): boolean => {
    if (target.editGen() !== gen) return false;
    target.markClean();
    target.clearJournal();
    return true;
  };
}
