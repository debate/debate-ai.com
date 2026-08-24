/**
 * Keep the text selection visible while the editor is blurred.
 *
 * A contenteditable's native selection greys out / disappears the moment
 * focus moves elsewhere — e.g. when the command / search palette or a
 * find-bar input takes focus. That hides what the user had selected (and
 * what a palette command is about to act on). While the view is blurred
 * this plugin paints the selected range with the same tint as the live
 * `::selection`, then clears the instant focus returns and PM's real
 * selection takes over.
 */

import { Plugin, PluginKey, TextSelection } from 'prosemirror-state';
import type { EditorState } from 'prosemirror-state';
import { Decoration, DecorationSet } from 'prosemirror-view';

const frozenSelectionKey = new PluginKey<boolean>('frozen-selection');

export const frozenSelectionPlugin = new Plugin<boolean>({
  key: frozenSelectionKey,
  state: {
    init: () => false,
    apply(tr, blurred) {
      const meta = tr.getMeta(frozenSelectionKey);
      return typeof meta === 'boolean' ? meta : blurred;
    },
  },
  props: {
    decorations(state: EditorState) {
      if (!frozenSelectionKey.getState(state)) return null;
      const sel = state.selection;
      // Only text selections — node selections keep their own
      // `ProseMirror-selectednode` styling, which survives blur.
      if (!(sel instanceof TextSelection) || sel.empty) return null;
      return DecorationSet.create(state.doc, [
        Decoration.inline(sel.from, sel.to, { class: 'pmd-frozen-selection' }),
      ]);
    },
  },
  view(view) {
    const set = (blurred: boolean): void => {
      if (frozenSelectionKey.getState(view.state) === blurred) return;
      try {
        view.dispatch(view.state.tr.setMeta(frozenSelectionKey, blurred).setMeta('addToHistory', false));
      } catch {
        // View tearing down mid-blur — nothing to paint.
      }
    };
    const onBlur = (): void => set(true);
    const onFocus = (): void => set(false);
    view.dom.addEventListener('blur', onBlur);
    view.dom.addEventListener('focus', onFocus);
    return {
      destroy() {
        view.dom.removeEventListener('blur', onBlur);
        view.dom.removeEventListener('focus', onFocus);
      },
    };
  },
});
