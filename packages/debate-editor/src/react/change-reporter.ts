/**
 * The embed's change reporter — how `<CardMirrorEditor>` decides that the
 * host's document actually changed.
 *
 * The host app treats `onChange` as "the user edited this document" and
 * writes the result straight to its own storage (D1, via
 * `/api/doc/documents/:id`). But the engine (`../editor/index.ts`) replaces
 * its whole editor state — and often the whole `EditorView` — on its own
 * initiative too: its boot sequence, crash recovery, the ribbon's New/Open,
 * a joined collaboration session. Those replacements land on the very view
 * the singleton handed the host's document to, and when what lands is the
 * engine's blank starter doc, the host's document is simply gone from the
 * screen — the "opened a file and it went blank" report.
 *
 * So this plugin sorts doc changes into three kinds:
 *
 *   - a TRANSACTION that changed the doc → a real edit; report it;
 *   - a transaction tagged {@link LOAD_META} → the singleton loading content
 *     into the view; not an edit, and not a replacement to undo;
 *   - a whole-state replacement → not an edit either, and handed to
 *     `onStateReplaced` so a blank one can be undone before anyone sees it.
 *
 * Two ProseMirror details shape how each is detected:
 *
 *   - Plugin `state.apply` runs for TRANSACTIONS ONLY, so counters kept there
 *     separate a real edit from a load without needing to inspect the doc.
 *   - A plugin view's `update` is NOT called when the editor state is
 *     replaced wholesale: `EditorState.create` builds a fresh plugin array,
 *     so `updatePluginViews` destroys the plugin views and builds new ones
 *     (and a brand-new `EditorView`, which is what the engine's `mountView`
 *     makes, does the same). The plugin's `view()` FACTORY running again is
 *     therefore the signal that the state underneath was swapped out.
 */

import { Plugin, PluginKey, type EditorState } from 'prosemirror-state';
import type { EditorView } from 'prosemirror-view';

/** Transaction meta marking a doc replacement the singleton performed itself
 *  — content arriving from the host, not an edit made in the editor. */
export const LOAD_META = 'load';

export const changeReporterKey = new PluginKey<{ edits: number }>('debate-editor-onchange');

export interface ChangeReporterHooks {
  /** True while the singleton is writing host content into the view, so its
   *  own state swap isn't mistaken for one the engine started. */
  isLoading: () => boolean;
  /** A real edit changed the document. */
  onEdit: (view: EditorView) => void;
  /** The editor state (or the view itself) was replaced wholesale by
   *  something other than the singleton's own load. */
  onStateReplaced: (view: EditorView) => void;
}

export function createChangeReporterPlugin(hooks: ChangeReporterHooks): Plugin<{ edits: number }> {
  return new Plugin<{ edits: number }>({
    key: changeReporterKey,
    state: {
      init: () => ({ edits: 0 }),
      apply: (tr, value) => {
        if (!tr.docChanged) return value;
        if (tr.getMeta(changeReporterKey) === LOAD_META) return value;
        return { edits: value.edits + 1 };
      },
    },
    view: (view: EditorView) => {
      if (!hooks.isLoading()) hooks.onStateReplaced(view);
      return {
        update(v: EditorView, prevState: EditorState) {
          if (v.state.doc.eq(prevState.doc)) return;
          const before = changeReporterKey.getState(prevState)?.edits ?? 0;
          const after = changeReporterKey.getState(v.state)?.edits ?? 0;
          // Only a rising edit counter is the user's work. Anything else
          // reaching this point is a load transaction, which the host already
          // knows about.
          if (after > before) hooks.onEdit(v);
        },
      };
    },
  });
}
