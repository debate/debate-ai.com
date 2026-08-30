/**
 * Trailing-pilcrow selection cue.
 *
 * When a selection's END sits at offset 0 of a textblock — the
 * Ctrl/Alt-Shift-Down (and native Shift-Down-past-a-block-end) shape — the
 * paragraph BREAK between the last visibly-selected block and that block is
 * inside the selection, even though no glyph marks it. Deleting or replacing
 * such a selection merges the two blocks, which is surprising because the
 * grabbed break is invisible.
 *
 * This plugin makes it visible, the way Word's end-of-paragraph selection
 * decoration shows you've swallowed the pilcrow: it draws a highlighted `¶`
 * at the end of the leading block whenever the selection grabs that block's
 * trailing break. Purely a cue — it changes no behavior. (Display-only
 * decoration, recomputed from the live selection; never a mark.)
 *
 * Detection mirrors `type-over-boundary.ts`: the selection end resolves to
 * `parentOffset === 0` of a textblock, and the selection starts before that
 * block — so a real break is captured (not a within-block selection).
 */

import { Plugin, PluginKey, Selection } from 'prosemirror-state';
import { Decoration, DecorationSet } from 'prosemirror-view';

const key = new PluginKey<DecorationSet>('pilcrowSelection');

function pilcrowWidget(): HTMLElement {
  const span = document.createElement('span');
  span.className = 'pmd-pilcrow-grab';
  span.textContent = '¶';
  span.setAttribute('aria-hidden', 'true');
  return span;
}

export const pilcrowSelectionPlugin: Plugin = new Plugin<DecorationSet>({
  key,
  props: {
    decorations(state) {
      const sel = state.selection;
      if (sel.empty) return null;
      const $to = state.doc.resolve(sel.to);
      // The selection's end must sit at the very start of a textblock.
      if (!$to.parent.isTextblock || $to.parentOffset !== 0) return null;
      // That block must not be where the selection starts — otherwise this
      // is an ordinary within-block selection, no break is grabbed.
      const tailBlockStart = $to.before($to.depth);
      if (sel.from >= tailBlockStart) return null;
      // The grabbed break sits at the END of the previous textblock, however
      // deep the structural nesting between the two blocks is.
      let leadingEnd: number;
      try {
        leadingEnd = Selection.near(state.doc.resolve(tailBlockStart), -1).to;
      } catch {
        return null;
      }
      if (leadingEnd <= sel.from) return null;
      return DecorationSet.create(state.doc, [
        Decoration.widget(leadingEnd, pilcrowWidget, {
          side: -1,
          key: 'pmd-pilcrow-grab',
          ignoreSelection: true,
        }),
      ]);
    },
  },
});
