/**
 * Repair-highlight plugin.
 *
 * A transient, view-only decoration layer for the Repair Text command. As
 * each fix is applied (one transaction at a time), an orange "flash" is
 * appended over the freshly-inserted text; the plugin maps existing flashes
 * through later edits so they stay on the right text. Like the find-result
 * highlight, these are decorations — never marks — so they never touch the
 * document or the export pipeline. `clear` empties the layer once the run
 * finishes and the flashes have faded.
 */

import { Plugin, PluginKey } from 'prosemirror-state';
import { Decoration, DecorationSet, type EditorView } from 'prosemirror-view';

interface Range {
  from: number;
  to: number;
}

type Meta =
  // Append one flash over a range in the POST-transaction doc (the just-
  // applied replacement). Existing flashes are mapped through tr first.
  | { type: 'add'; range: Range }
  // Replace the whole layer at once (reduced-motion: static, no walk-down).
  | { type: 'set'; ranges: Range[] }
  | { type: 'clear' };

const repairHighlightKey = new PluginKey<DecorationSet>('repair-highlight');

function flash(from: number, to: number): Decoration {
  return Decoration.inline(from, to, { class: 'pmd-repair-flash' });
}

export const repairHighlightPlugin = new Plugin<DecorationSet>({
  key: repairHighlightKey,
  state: {
    init: () => DecorationSet.empty,
    apply(tr, set) {
      const meta = tr.getMeta(repairHighlightKey) as Meta | undefined;
      if (meta?.type === 'clear') return DecorationSet.empty;
      if (meta?.type === 'add') {
        const mapped = set.map(tr.mapping, tr.doc);
        if (meta.range.to <= meta.range.from) return mapped;
        return mapped.add(tr.doc, [flash(meta.range.from, meta.range.to)]);
      }
      if (meta?.type === 'set') {
        const decos = meta.ranges.filter((r) => r.to > r.from).map((r) => flash(r.from, r.to));
        return DecorationSet.create(tr.doc, decos);
      }
      return set.map(tr.mapping, tr.doc);
    },
  },
  props: {
    decorations(state) {
      return repairHighlightKey.getState(state);
    },
  },
});

/** Replace the whole flash layer at once (reduced-motion path). */
export function setRepairFlashes(view: EditorView, ranges: Range[]): void {
  view.dispatch(view.state.tr.setMeta(repairHighlightKey, { type: 'set', ranges }));
}

/** Clear all flashes. */
export function clearRepairFlashes(view: EditorView): void {
  try {
    view.dispatch(view.state.tr.setMeta(repairHighlightKey, { type: 'clear' }));
  } catch {
    // View torn down — nothing to clear.
  }
}
