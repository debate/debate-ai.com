/**
 * Custom-caret plugin (italic slant + steady-cursor accessibility).
 *
 * Two cases need a custom caret drawn over the cursor's screen position,
 * with the native caret hidden:
 *  - ITALIC PENDING: the next typed character would be italic (a collapsed
 *    cursor whose effective marks include `italic`). The native caret can't
 *    slant, so we draw a thin slanted caret. The native caret returns the
 *    moment typing wouldn't be italic.
 *  - STEADY CURSOR (accessibility `disableCursorBlink`): the native caret
 *    blinks and that can't be turned off in CSS, so when the setting is on
 *    we hide it (a `body.pmd-steady-cursor` class) and draw a steady,
 *    upright caret at any collapsed cursor.
 *
 * The caret is a single `position: fixed` element positioned from
 * `view.coordsAtPos` (viewport coordinates), repositioned on every
 * selection change, scroll, resize, focus change, and settings change.
 * Blink (or not) and slant (or not) are driven entirely by CSS classes.
 */

import { Plugin } from 'prosemirror-state';
import type { EditorState } from 'prosemirror-state';
import type { EditorView } from 'prosemirror-view';
import { schema } from '../schema/index.js';
import { settings } from './settings.js';

/** True when a collapsed cursor would type italic text. */
function italicPending(state: EditorState): boolean {
  const sel = state.selection;
  if (!sel.empty) return false;
  const italic = schema.marks['italic'];
  if (!italic) return false;
  const marks = state.storedMarks ?? sel.$from.marks();
  return marks.some((m) => m.type === italic);
}

/** Whether the custom caret should be drawn (and the native one hidden). */
function caretActive(state: EditorState): boolean {
  if (italicPending(state)) return true;
  return settings.get('disableCursorBlink') && state.selection.empty;
}

export const italicCaretPlugin = new Plugin({
  props: {
    attributes(state): { [name: string]: string } {
      // Hide the native caret for the italic case. The steady-cursor
      // case hides it globally via the `body.pmd-steady-cursor` class.
      return italicPending(state) ? { class: 'pmd-italic-caret-active' } : {};
    },
  },
  view(view: EditorView) {
    const caret = document.createElement('div');
    caret.className = 'pmd-italic-caret';
    caret.setAttribute('aria-hidden', 'true');
    caret.style.display = 'none';
    document.body.appendChild(caret);

    let raf = 0;

    const reposition = (): void => {
      raf = 0;
      if (!view.editable || !view.hasFocus() || !caretActive(view.state)) {
        caret.style.display = 'none';
        return;
      }
      let coords;
      try {
        coords = view.coordsAtPos(view.state.selection.head);
      } catch {
        caret.style.display = 'none';
        return;
      }
      caret.classList.toggle('pmd-caret-slant', italicPending(view.state));
      caret.style.display = 'block';
      caret.style.left = `${coords.left}px`;
      caret.style.top = `${coords.top}px`;
      caret.style.height = `${Math.max(1, coords.bottom - coords.top)}px`;
    };

    const schedule = (): void => {
      if (raf) return;
      raf = requestAnimationFrame(reposition);
    };

    // Scroll (capture, to catch the inner editor scrollers), resize, and
    // focus changes don't fire plugin `update`, so listen explicitly. A
    // settings change can flip the steady-cursor mode without a transaction.
    window.addEventListener('scroll', schedule, true);
    window.addEventListener('resize', schedule);
    view.dom.addEventListener('focus', schedule);
    view.dom.addEventListener('blur', schedule);
    const unsubscribe = settings.subscribe(() => schedule());
    reposition();

    return {
      update: () => schedule(),
      destroy: () => {
        if (raf) cancelAnimationFrame(raf);
        window.removeEventListener('scroll', schedule, true);
        window.removeEventListener('resize', schedule);
        view.dom.removeEventListener('focus', schedule);
        view.dom.removeEventListener('blur', schedule);
        unsubscribe();
        caret.remove();
      },
    };
  },
});
