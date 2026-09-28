/**
 * Keyboard macros — user-defined "press a key → type this text" bindings.
 *
 * Each macro maps a ProseMirror-keymap key string to a command that
 * inserts its literal text at the cursor (replacing any selection), the
 * same as if the user had typed it. Built into a `keymap()` and slotted
 * into the editor plugin stack ahead of the ribbon keymap, so a macro
 * key wins over a command bound to the same key. Configured in Settings →
 * Keyboard shortcuts → Keyboard macros. The insert carries its text in a
 * meta so Word-style Repeat counts it as typing (repeat-last-action.ts).
 */

import type { Command } from 'prosemirror-state';
import type { KeyboardMacro } from './settings.js';
import { REPEAT_TYPING_META } from './repeat-last-action.js';

/** Produce a `keymap()`-ready binding object from the macro list. Macros
 *  with no key or no text are skipped; a later macro on the same key
 *  overrides an earlier one. */
export function buildMacroKeymap(macros: KeyboardMacro[]): Record<string, Command> {
  const out: Record<string, Command> = {};
  for (const m of macros) {
    if (!m.key || !m.text) continue;
    const text = m.text;
    out[m.key] = (state, dispatch) => {
      if (dispatch) dispatch(state.tr.insertText(text).setMeta(REPEAT_TYPING_META, text).scrollIntoView());
      return true;
    };
  }
  return out;
}
