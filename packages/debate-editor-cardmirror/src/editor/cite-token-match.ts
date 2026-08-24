/**
 * Cite-token matching — locating "Lastname ShortDate" spans inside a
 * formatted cite and applying `cite_mark` to them.
 *
 * Shared by the AI cite creator (tokens come from the model's TOKENS
 * block) and the external-insert bridge (tokens come from the sender's
 * `citeTokens` payload field, e.g. Fast Debate Paste relaying the
 * Research Tracker extension's F8 trailer). Lives outside `ai/` on
 * purpose: the bridge path must not drag the LLM plumbing into every
 * insert, and Lite builds carry the bridge but not the AI stack.
 */

import type { Transaction } from 'prosemirror-state';
import type { MarkType } from 'prosemirror-model';

/** Case / typography folding for token matching, strictly 1:1 per
 *  character so a match's offsets in the folded string ARE its offsets
 *  in the real text. Curly quotes → straight, en/em/minus dashes →
 *  hyphen, NBSP → space, casefold (skipped for the rare characters
 *  whose lowercase form changes length). */
export function foldForTokenMatch(s: string): string {
  let out = '';
  for (const ch of s) {
    let c = ch;
    if (c === '‘' || c === '’' || c === 'ʼ') c = "'";
    else if (c === '“' || c === '”') c = '"';
    else if (c === '–' || c === '—' || c === '−') c = '-';
    else if (c === '\u00a0') c = ' ';
    const lower = c.toLowerCase();
    out += lower.length === c.length ? lower : c;
  }
  return out;
}

/**
 * FUZZY token application. Exact `indexOf` was the original matcher,
 * and producer drift — a case change, a curly vs straight quote, an
 * en dash, stray edge punctuation — made it silently mark NOTHING
 * (field report, beta.22). Both sides are folded (1:1 per char so
 * offsets carry straight back to the real text); a token that still
 * misses retries with its edge punctuation trimmed. No fallback
 * marking beyond that: if a token genuinely isn't in the cite,
 * nothing is marked.
 *
 * `start` is the document position of `citeText`'s first character;
 * the text at [start, start + citeText.length) must be exactly
 * `citeText` (1:1 offsets). Returns how many tokens found a home.
 */
export function markCiteTokensInText(
  tr: Transaction,
  start: number,
  citeText: string,
  tokens: readonly string[],
  citeType: MarkType,
): number {
  const end = start + citeText.length;
  const foldedCite = foldForTokenMatch(citeText);
  let markedTokens = 0;
  for (const token of tokens) {
    if (!token) continue;
    const candidates = [foldForTokenMatch(token)];
    const trimmed = candidates[0]!.replace(/^[\s.,;:'"()]+|[\s.,;:'"()]+$/g, '');
    if (trimmed && trimmed !== candidates[0]) candidates.push(trimmed);
    for (const needle of candidates) {
      let found = false;
      let searchOffset = 0;
      while (searchOffset <= foldedCite.length - needle.length) {
        const idx = foldedCite.indexOf(needle, searchOffset);
        if (idx < 0) break;
        const matchStart = start + idx;
        const matchEnd = matchStart + needle.length;
        if (matchEnd > end) break;
        tr.addMark(matchStart, matchEnd, citeType.create());
        found = true;
        searchOffset = idx + needle.length;
      }
      if (found) {
        markedTokens++;
        break;
      }
    }
  }
  return markedTokens;
}
