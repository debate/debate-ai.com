/**
 * Plain-text rendering of the keyboard-shortcuts reference, shared by
 * the "Export…" (saved as a `.txt` file via the host's `saveAs`) and
 * "Print" (built into a print-only DOM fragment, see `reference-ui.ts`)
 * actions on the reference modal.
 *
 * Kept separate from `reference-ui.ts` so the formatting logic — the
 * part worth covering with a fast, DOM-free test — doesn't drag the
 * modal's DOM-building/overlay-lifecycle code along with it.
 */

/** One command row: the label CardMirror shows for it plus its
 *  current keybinding(s) already formatted for display (e.g.
 *  `"Ctrl+Shift+K"` or `"F8 / Ctrl+Shift+X"`), or `''` when unbound. */
export interface ShortcutsReferenceRow {
  label: string;
  keyText: string;
}

/** A thematic section of the reference (mirrors a `RIBBON_GROUPS`
 *  entry, or the trailing "Plugins" section). */
export interface ShortcutsReferenceGroup {
  title: string;
  rows: ShortcutsReferenceRow[];
}

const EM_DASH = '—';

/**
 * Renders the reference as plain text: a title, then one heading per
 * non-empty group with its rows key-aligned underneath. Matches the
 * on-screen modal's content exactly (same groups/rows, no search
 * filter applied — an export/print is always the full reference).
 */
export function formatShortcutsReferenceText(
  groups: ShortcutsReferenceGroup[],
): string {
  const nonEmpty = groups.filter((g) => g.rows.length > 0);
  const widestKey = Math.max(
    0,
    ...nonEmpty.flatMap((g) =>
      g.rows.map((r) => (r.keyText || EM_DASH).length),
    ),
  );

  const lines: string[] = ['Keyboard shortcuts', ''];
  for (const group of nonEmpty) {
    lines.push(group.title);
    for (const row of group.rows) {
      const key = (row.keyText || EM_DASH).padEnd(widestKey, ' ');
      lines.push(`  ${key}  ${row.label}`);
    }
    lines.push('');
  }
  // Single trailing newline, no trailing blank line.
  while (lines.length > 0 && lines[lines.length - 1] === '') lines.pop();
  return lines.join('\n') + '\n';
}
