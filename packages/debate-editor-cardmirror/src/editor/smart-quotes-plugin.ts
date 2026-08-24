/**
 * Word-style smart quotes, gated on the `smartQuotes` setting (default off).
 *
 * As you type a straight `'` or `"`, it's replaced with the correctly-curled
 * character based on the PRECEDING character: an opening curl after a block
 * start / whitespace / an opening bracket / a dash / another opening quote, and
 * a closing curl otherwise — including after an inline atom such as a footnote
 * marker, which counts as word-like closing context (same as Word). The closing
 * single quote doubles as the apostrophe, so `don't` / `John's` fall out for
 * free. (Leading elisions like `'tis` / `'90s` curl as opening quotes — same as
 * Word; use the Flip Quote Direction command to fix those.)
 *
 * Conversion mechanics + the Backspace-revert window live in the shared
 * autocorrect engine (autocorrect.ts) — this module is just the rule.
 *
 * Produces curly characters, which `normalizeForMatch` / `foldQuotes` already
 * fold for Find + Paragraph Integrity — so search still matches either form.
 */

import { PluginKey } from 'prosemirror-state';
import type { Plugin } from 'prosemirror-state';
import { settings } from './settings.js';
import { makeAutocorrectPlugin, type AutocorrectRule, type AutocorrectState } from './autocorrect.js';

/** A typed quote opens (vs. closes) when the character before it is one of
 *  these — PM's built-in set (whitespace, `{[(<`, straight quotes, opening curly
 *  quotes) PLUS the em-dash and en-dash (the Word behavior PM lacks). */
const OPENING_BEFORE = /[\s{\[(<'"‘“—–]/;

export const smartQuotesKey = new PluginKey<AutocorrectState>('pmd-smart-quotes');

/** Pick the curled character for `typed` ('\'' or '"') given the preceding
 *  character `prev` ('' for block start). Exported for tests. */
export function curlFor(typed: string, prev: string): string {
  const opening = prev === '' || OPENING_BEFORE.test(prev);
  if (typed === '"') return opening ? '“' : '”';
  return opening ? '‘' : '’';
}

const smartQuotesRule: AutocorrectRule = {
  triggers: (text) => text === "'" || text === '"',
  enabled: () => settings.get('smartQuotes'),
  match(state, from, _to, text) {
    const $from = state.doc.resolve(from);
    // '' at a block start → opening context.
    let prev = $from.parentOffset === 0 ? '' : state.doc.textBetween(from - 1, from);
    // A preceding inline ATOM (footnote marker etc.) also yields '' from
    // textBetween — but it's word-like CLOSING context, not a block start
    // (typing a closing quote right after a footnote used to curl open;
    // review fix, 2026-07-13). The sentinel is any non-opening character.
    if (prev === '' && $from.parentOffset > 0) prev = '￼';
    return { replaceFrom: from, insert: curlFor(text, prev), revertTo: text };
  },
};

export function smartQuotesPlugin(): Plugin<AutocorrectState> {
  return makeAutocorrectPlugin(smartQuotesKey, [smartQuotesRule]);
}
