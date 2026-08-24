/**
 * Fused selection-chrome computation (perf audit A-01, 2026-07-11).
 *
 * The ribbon/status readouts that mirror a RANGE selection — font-size chip,
 * formatting-panel mark buttons, numbering buttons — used to make separate
 * O(selection) walks per transaction: one `nodesBetween` for font sizes, one
 * `doc.rangeHasMark` PER mark button (and prosemirror's rangeHasMark never
 * stops iterating early, even after a hit), and one more `nodesBetween` for
 * the in-scope card units. This module answers all three questions in ONE
 * pass over the selection.
 *
 * Only the non-empty-selection case lives here — every consumer's
 * empty-selection path is O(1) and stays where it was. Dependencies are
 * injected (`ptForRun` reads the displaySizes setting in index.ts) so the
 * walk itself is a pure function of the editor state and unit-testable
 * against naive per-question reference implementations.
 */

import type { EditorState } from 'prosemirror-state';
import type { Node as PMNode } from 'prosemirror-model';

export interface SelectionChrome {
  /** Uniform effective size across the selection's text runs, or null when
   *  mixed / no runs. `direct` = every run carries an explicit font_size
   *  mark (the chip's "red" state). Same semantics as the old
   *  effectiveFontSizeForDisplay range branch. */
  font: { pt: number | null; direct: boolean };
  /** Per requested mark name: present anywhere in the range (same answer as
   *  `doc.rangeHasMark(from, to, type)`). */
  markActive: Record<string, boolean>;
  /** Card / analytic_unit nodes intersecting the selection, in document
   *  order — same set as numbering's `inScopeCardUnits` range branch (cards
   *  never nest, so recording + descending yields the identical list). */
  units: { pos: number; node: PMNode }[];
}

export function computeSelectionChrome(
  state: EditorState,
  markNames: readonly string[],
  ptForRun: (text: PMNode, parent: PMNode) => { pt: number; direct: boolean },
): SelectionChrome {
  const sel = state.selection;
  const markActive: Record<string, boolean> = {};
  for (const name of markNames) markActive[name] = false;
  let marksLeft = markNames.length;
  const markTypes = markNames
    .map((name) => [name, state.schema.marks[name]] as const)
    .filter((pair) => pair[1] != null);

  const found = new Set<number>();
  let allDirect = true;
  let anyRun = false;
  const units: { pos: number; node: PMNode }[] = [];

  state.doc.nodesBetween(sel.from, sel.to, (node, pos, parent) => {
    // Text runs vastly outnumber structure nodes — test isText first so the
    // hot path pays no type-name comparisons.
    if (node.isText) {
      if (!parent) return true;
      const r = ptForRun(node, parent);
      found.add(r.pt);
      if (!r.direct) allDirect = false;
      anyRun = true;
      // Once every requested mark has been seen the per-run check
      // disappears; when a mark is absent from the whole range this stays
      // O(runs × marks) — the same lower bound rangeHasMark pays, minus
      // its two extra traversals.
      if (marksLeft > 0) {
        for (const [name, type] of markTypes) {
          if (!markActive[name] && type!.isInSet(node.marks)) {
            markActive[name] = true;
            marksLeft--;
          }
        }
      }
      return true;
    }
    const t = node.type.name;
    if (t === 'card' || t === 'analytic_unit') {
      units.push({ pos, node }); // still descend: runs inside feed font/marks
    }
    return true;
  });

  const font =
    !anyRun || found.size !== 1
      ? { pt: null, direct: false }
      : { pt: [...found][0]!, direct: allDirect };
  return { font, markActive, units };
}
