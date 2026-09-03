/**
 * Resolve a folder-list "Browse…" repoint against the CURRENT list.
 *
 * The native picker can sit open indefinitely while another window
 * edits the same list (settings sync across windows via the `storage`
 * event), so the row is identified by VALUE, not by its render-time
 * index — the index may be stale by the time the picker resolves.
 * Add and repoint both dedup, so the list never holds duplicates and
 * the value lookup is unambiguous.
 *
 * Pure and separate from the settings modal so the stale-list cases
 * are directly testable without a DOM harness.
 */

/** The new list, or null when there is nothing to change (same folder
 *  re-picked, or the row was removed while the picker sat open). */
export function repointFolderRoot(
  roots: readonly string[],
  oldPath: string,
  picked: string,
): string[] | null {
  if (picked === oldPath) return null;
  const idx = roots.indexOf(oldPath);
  if (idx === -1) return null; // row vanished while the picker was open
  // Repointing onto a folder already in the list just drops this row.
  if (roots.includes(picked)) return roots.filter((_, j) => j !== idx);
  return roots.map((r, j) => (j === idx ? picked : r));
}
