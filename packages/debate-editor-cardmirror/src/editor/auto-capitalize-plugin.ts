/**
 * Auto-capitalization for TAGS and ANALYTICS, gated on the
 * `autoCapitalizeSentences` setting (default off).
 *
 * Word-style commit-time behavior: nothing happens while a word is being
 * typed — when a DELIMITER (space or `. , ; : ! ?`) commits it, a lowercase
 * word at a sentence start is capitalized, and a standalone `i` becomes `I`
 * anywhere. The scope is deliberately tags/analytics ONLY: card bodies are
 * excerpts from sources whose casing must be preserved verbatim, cite
 * paragraphs are abbreviation-dense (wrong-fire soup), and loose paragraphs
 * follow the body's fidelity rule. Tags and analytics are the user's own
 * prose (user decision, 2026-07-13).
 *
 * The decision logic lives in a pure function (`capitalizationFor`, exported
 * for table tests — the `curlFor` pattern) with the believability guards:
 * a period is NOT a sentence end after a single letter (initials, the
 * middles of `e.g.` / `U.S.`) or a known abbreviation (`etc.`, `vs.`,
 * `pp.`, months, …); an ellipsis never ends a sentence; `i` stays lowercase
 * in `(i` (enumeration markers); inline atoms (footnote markers) are opaque
 * — never sentence context. A word whose marks are NON-uniform is skipped:
 * the whole-word replacement inherits only the marks common to the range,
 * so capitalizing a partially-marked word would eat the partial marking —
 * conservative no-fire wins.
 *
 * Conversion mechanics + the Backspace-revert window live in the shared
 * autocorrect engine (autocorrect.ts): Backspace right after a
 * capitalization restores the lowercase word + delimiter.
 *
 * Known v1 limits (deliberate): Enter doesn't commit a word (it's a keydown,
 * not text input, so the engine's trigger path never sees it); quote
 * characters aren't delimiters (the smart-quotes rule owns them — rule
 * composition is a future engine feature); pasted text is untouched.
 */

import { PluginKey } from 'prosemirror-state';
import type { Plugin } from 'prosemirror-state';
import { settings } from './settings.js';
import {
  makeAutocorrectPlugin,
  marksAreUniform,
  WORD_COMMIT_DELIMITER,
  type AutocorrectDecorator,
  type AutocorrectRule,
  type AutocorrectState,
} from './autocorrect.js';

const WORD_CHAR = /[\p{L}\p{N}'’]/u;
const SENTENCE_END = /[.!?]/;
/** Closers that may sit between a terminator and the whitespace before the
 *  new sentence: `He said "stop!") next` still starts a sentence at `next`. */
const CLOSER = /[)\]}"'’”]/;

/** Dot-attached tokens that don't end a sentence. Single letters (initials,
 *  `e.g.`/`U.S.` middles) are guarded structurally, so only multi-letter
 *  abbreviations live here. Cite-flavored entries matter even in tags —
 *  users quote sources in analytics. */
const ABBREVIATIONS = new Set([
  'etc', 'vs', 'cf', 'ca', 'al', 'st', 'no', 'nos', 'vol', 'vols', 'ed', 'eds',
  'pp', 'fig', 'figs', 'ch', 'sec', 'para', 'approx', 'dept', 'est',
  'mr', 'mrs', 'ms', 'dr', 'prof', 'rev', 'gen', 'sen', 'rep', 'gov', 'jr', 'sr',
  'jan', 'feb', 'mar', 'apr', 'jun', 'jul', 'aug', 'sep', 'sept', 'oct', 'nov', 'dec',
]);

export interface CapitalizationHit {
  /** Offset of the word's first character within the scanned string. */
  wordStart: number;
  word: string;
  cap: string;
}

/**
 * The pure decision: given the textblock's content BEFORE the caret (inline
 * atoms encoded as U+FFFC), should the trailing word be capitalized?
 * Exported for table tests.
 */
export function capitalizationFor(before: string): CapitalizationHit | null {
  let ws = before.length;
  while (ws > 0 && WORD_CHAR.test(before[ws - 1]!)) ws--;
  const word = before.slice(ws);
  if (!word) return null;
  if (!/^\p{Ll}/u.test(word)) return null; // already capitalized / digit / atom
  const cap = word[0]!.toUpperCase() + word.slice(1);
  if (cap === word) return null; // caseless script — nothing to do

  // Standalone `i` → `I` anywhere — except `(i`, an enumeration marker.
  if (word === 'i') {
    if (before[ws - 1] === '(') return null;
    return { wordStart: ws, word, cap: 'I' };
  }

  // Everything else needs a sentence start: block start, or a terminator
  // (possibly followed by closers) before the whitespace gap.
  let i = ws;
  while (i > 0 && /\s/.test(before[i - 1]!)) i--;
  if (i === ws) {
    // No whitespace between the terminator and the word ("word.next"):
    // mid-token punctuation (URLs, decimals, ellipses) — never a sentence.
    if (i !== 0) return null;
    return { wordStart: ws, word, cap }; // block start
  }
  if (i === 0) return { wordStart: ws, word, cap }; // leading-space block start
  let j = i;
  while (j > 0 && CLOSER.test(before[j - 1]!)) j--;
  if (j === 0) return null;
  const term = before[j - 1]!;
  if (!SENTENCE_END.test(term)) return null;
  if (term === '.') {
    // An ellipsis (`...` or `…`) trails off — it doesn't end the sentence.
    if (j >= 2 && before[j - 2] === '.') return null;
    // The token the period is attached to:
    let k = j - 1;
    while (k > 0 && /[\p{L}\p{N}]/u.test(before[k - 1]!)) k--;
    const tok = before.slice(k, j - 1);
    if (tok.length === 0) return null; // ". ." / "…." debris — bail
    if (tok.length === 1 && /\p{L}/u.test(tok)) return null; // initials, e.g., U.S.
    if (ABBREVIATIONS.has(tok.toLowerCase())) return null;
  }
  return { wordStart: ws, word, cap };
}

export const autoCapitalizeKey = new PluginKey<AutocorrectState>('pmd-auto-capitalize');

const autoCapitalizeRule: AutocorrectRule = {
  triggers: (text) => WORD_COMMIT_DELIMITER.test(text),
  enabled: () => settings.get('autoCapitalizeSentences'),
  match(state, from, _to, text) {
    const $from = state.doc.resolve(from);
    const pt = $from.parent.type.name;
    if (pt !== 'tag' && pt !== 'analytic') return null;
    const before = $from.parent.textBetween(0, $from.parentOffset, undefined, '￼');
    const hit = capitalizationFor(before);
    if (!hit) return null;
    const wordFrom = from - (before.length - hit.wordStart);
    if (!marksAreUniform(state.doc, wordFrom, from)) return null;
    return { replaceFrom: wordFrom, insert: hit.cap + text, revertTo: hit.word + text };
  },
};

export function autoCapitalizePlugin(): Plugin<AutocorrectState> {
  return makeAutocorrectPlugin(autoCapitalizeKey, [autoCapitalizeRule]);
}

/**
 * Decorator form: capitalizes the leading word of ANOTHER rule's pending
 * insert (a custom text replacement) under exactly the standalone rule's
 * conditions — same setting, same tag/analytic scope, same sentence-start
 * guards, evaluated against the hypothetical committed text. `revertTo` is
 * untouched, so Backspace restores the literal the user typed and unwinds
 * both the replacement and the capitalization in one step.
 */
export const autoCapitalizeDecorator: AutocorrectDecorator = (state, m, _to, text) => {
  if (!settings.get('autoCapitalizeSentences')) return m;
  const $pos = state.doc.resolve(m.replaceFrom);
  const pt = $pos.parent.type.name;
  if (pt !== 'tag' && pt !== 'analytic') return m;
  const body = m.insert.slice(0, m.insert.length - text.length);
  const lead = body.match(/^[\p{L}\p{N}'’]+/u)?.[0];
  if (!lead) return m;
  const before = $pos.parent.textBetween(0, $pos.parentOffset, undefined, '￼');
  const hit = capitalizationFor(before + lead);
  // Only when the capitalization lands exactly on the insert's leading word
  // (i.e. the REPLACEMENT starts the sentence, not some earlier word).
  if (!hit || hit.wordStart !== before.length) return m;
  return { ...m, insert: hit.cap + body.slice(lead.length) + text };
};
