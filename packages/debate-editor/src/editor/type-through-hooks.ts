/**
 * Type text the way the keyboard delivers it: one chunk at a time through
 * the view's `handleTextInput` hooks, so the autocorrect engine (smart
 * quotes, dashes, autocapitalize, custom autocorrects) and every other
 * text-input consumer see it exactly as typed input. Shared by voice
 * dictation landing and by Word-style Repeat's typing replay.
 */
import type { EditorView } from 'prosemirror-view';
import type { Transaction } from 'prosemirror-state';

/** Split into the chunks the typing hook receives one at a time: a run of
 *  letters / digits as one chunk, every other character on its own, so a
 *  single-character trigger (a quote, a dash, a space) arrives alone. */
export function typingChunks(text: string): string[] {
  const out: string[] = [];
  let word = '';
  for (const ch of text) {
    if (/[\p{L}\p{N}]/u.test(ch)) {
      word += ch;
      continue;
    }
    if (word) {
      out.push(word);
      word = '';
    }
    out.push(ch);
  }
  if (word) out.push(word);
  return out;
}

/** Type `text` at the selection through the view's text-input hooks. A
 *  hook that claims a chunk dispatches its own transaction; `tag` must
 *  dispatch the plain insert for every chunk none claimed. Returns the
 *  inserted range. */
export function typeThroughInputRules(view: EditorView, text: string, tag: (tr: Transaction) => void): { from: number; to: number } {
  const start = view.state.selection.from;
  for (const chunk of typingChunks(text)) {
    const { from, to } = view.state.selection;
    const handled = view.someProp('handleTextInput', (f) => f(view, from, to, chunk, () => view.state.tr.insertText(chunk, from, to)));
    if (!handled) {
      const tr = view.state.tr.insertText(chunk, from, to);
      tag(tr);
    }
  }
  return { from: start, to: view.state.selection.from };
}
