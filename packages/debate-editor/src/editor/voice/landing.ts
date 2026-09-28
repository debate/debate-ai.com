/**
 * Dictation landing (spec §5.1): dictated text enters the document the
 * way typed text does — through ProseMirror's `handleTextInput` prop —
 * so the autocorrect engine and custom expansions apply with no
 * voice-specific transformation layer. Word chunks go in whole; every
 * non-word character goes in on its own, because that is what the
 * engine's rules key on (a space commits the word before it, `---`
 * becomes an em dash one dash at a time, quotes curl).
 *
 * The sticky pen, if armed, is set as a stored mark THROUGH the ribbon
 * command before typing (a collapsed-selection apply), so every chunk
 * inherits it and the utterance stays one adjacent history group — a
 * mark step applied afterwards would open a second undo step, because
 * prosemirror-history treats a mark-only step as non-adjacent.
 */
import type { EditorView } from 'prosemirror-view';
import { settings } from '../settings.js';
import { enterAsKey } from '../enter-style.js';
import { transformDictation, capitalizeForContext } from './dictation-text.js';
import { PEN_MARK_NAMES, type DispatchDeps } from './dispatch.js';
import { getRibbonCommand, type RibbonContext } from '../ribbon-commands.js';
import type { Transaction } from 'prosemirror-state';
import { patchVoiceState, sealUtterance, voiceDispatcher, voicePluginKey } from './plugin.js';
import type { PenName } from './types';
import { typingChunks, typeThroughInputRules } from '../type-through-hooks.js';

// `typingChunks` / `typeThroughInputRules` live in type-through-hooks.ts
// (shared with Repeat's typing replay); re-exported for the tests.
export { typingChunks, typeThroughInputRules };

export interface LandingOptions {
  utteranceId: number;
  pen: PenName | null;
  deps: DispatchDeps;
  /** Already cleaned (§6.4) or raw; spoken punctuation and the dash
   *  word are still resolved here. */
  text: string;
}

/** The pen's mark is among the marks the next typed text will carry. */
function penArmed(view: EditorView, pen: PenName): boolean {
  const st = view.state;
  const marks = st.storedMarks ?? st.selection.$from.marks();
  return PEN_MARK_NAMES[pen].some((nm) => marks.some((m) => m.type.name === nm));
}

/** Arm the pen as a stored mark at the caret. Underline goes through the
 *  ribbon's own typing toggle (it picks the named or direct mark by
 *  context); emphasis and highlight set their mark directly, highlight in
 *  the ribbon's current color. */
function armPen(view: EditorView, deps: DispatchDeps, pen: PenName, dispatch: (tr: Transaction) => void): void {
  if (penArmed(view, pen)) return;
  if (pen === 'underline') {
    const toggle = getRibbonCommand('toggleUnderlineTyping', deps.ribbonCtx);
    toggle(view.state, dispatch, view);
    if (!penArmed(view, pen)) toggle(view.state, dispatch, view); // undo an accidental toggle-off
    return;
  }
  const mt = view.state.schema.marks[pen === 'emphasis' ? 'emphasis_mark' : 'highlight'];
  if (!mt) return;
  const color = (deps.ribbonCtx as RibbonContext | undefined)?.highlightColor?.() ?? 'yellow';
  const mark = pen === 'highlight' ? mt.create({ color }) : mt.create();
  const current = view.state.storedMarks ?? view.state.selection.$from.marks();
  dispatch(view.state.tr.setStoredMarks(mark.addToSet(current)));
}

/** Spoken paragraph breaks inside a dictation, matched as whole words;
 *  a literal newline (a cleanup pass may emit one) counts too. The
 *  phrases ALWAYS break — "a new line of argument" splits, the same
 *  trade every dictation product makes; type those words instead. */
const BREAK_RE = /\s*(?:\bnew paragraph\b|\bnew line\b|\bnewline\b|\n)\s*/gi;
export function splitDictationBreaks(text: string): string[] {
  return text.split(BREAK_RE).map((s) => s.trim());
}

/** Land a dictation utterance at the cursor. */
export function landDictation(view: EditorView, opts: LandingOptions): void {
  const dispatch = voiceDispatcher(view, opts.utteranceId);
  const sel = view.state.selection;
  const context = view.state.doc.textBetween(Math.max(0, sel.from - 40), sel.from, '\n', ' ');
  const segments = splitDictationBreaks(transformDictation(opts.text, settings.get('voiceDashStyle')));
  if (segments.every((seg) => !seg)) return;
  segments.forEach((raw, i) => {
    if (i > 0) {
      // "new paragraph": Enter as the key does it, then re-arm the pen
      // (a split clears stored marks) so the next line stays marked.
      enterAsKey(view.state, dispatch, view);
      if (opts.pen) armPen(view, opts.deps, opts.pen, dispatch);
    }
    const text = capitalizeForContext(raw, i === 0 ? context : '');
    if (!text) return;
    if (i === 0) {
      const before = context.slice(-1);
      const needsSpace = before !== '' && !/[\s([{«“"'—–-]$/.test(before);
      if (needsSpace) typeThroughInputRules(view, ' ', dispatch);
      if (opts.pen) armPen(view, opts.deps, opts.pen, dispatch);
    }
    typeThroughInputRules(view, text, dispatch);
  });
  dispatch(view.state.tr.scrollIntoView());
  sealUtterance(view);
  patchVoiceState(view, { appendLog: { utteranceId: opts.utteranceId, kind: 'dictation', text: opts.text } });
  void voicePluginKey;
}
