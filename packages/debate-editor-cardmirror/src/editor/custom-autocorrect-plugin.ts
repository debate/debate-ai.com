/**
 * User-defined text replacements (Word's "replace text as you type"), gated
 * on `customAutocorrectEnabled` + the `customAutocorrects` table (both under
 * Settings → Editing → Typing). Fourth rule on the shared autocorrect engine.
 *
 * Commit-time semantics: typing a delimiter (space or `. , ; : ! ?`) looks
 * back at the sequence just committed; if it matches an entry's `from` — with
 * a boundary before it, so `wk` never fires inside `fwk`, and a punctuation-
 * led key like `--` never fires inside a longer run — the sequence and the
 * delimiter are replaced by `to` + delimiter. Backspace right after restores
 * the literal (engine revert window). Scope: EVERYWHERE — an expansion is the
 * user's explicit intent regardless of block (unlike auto-capitalization).
 *
 * Case adaptation (Word parity) for all-lowercase keys: `fwk` also matches
 * `Fwk` → `Framework` and `FWK` → `FRAMEWORK`; other mixed-case typings don't
 * fire. A key defined with any uppercase matches literally only.
 *
 * CLASH SEMANTICS (design decision, 2026-07-13): all autocorrect rules
 * resolve deterministically — registration order is smart quotes → custom
 * dash → custom replacements (+ capitalize decorator) → auto-capitalization,
 * first match wins, one atomic transaction per keystroke, and conversion
 * output is never re-fed as typed input (no cascades possible). An entry can
 * still be UNREACHABLE when a char-triggered rule consumes its key as it's
 * typed (e.g. `--`→`---` while Custom dash uses the `--` trigger converts on
 * the second hyphen, before any commit): `entryConflictWarnings` computes
 * those statically and the settings table shows them on the affected rows —
 * plus duplicate keys are refused outright at add time. Runtime stays
 * graceful either way: the earlier rule simply wins.
 *
 * Composition: `autoCapitalizeDecorator` runs over this rule's matches, so
 * `fwk` → `Framework` at a tag's sentence start when auto-capitalization is
 * also on. One Backspace still reverts to the typed literal.
 */

import { PluginKey } from 'prosemirror-state';
import type { Plugin } from 'prosemirror-state';
import { settings } from './settings.js';
import {
  makeAutocorrectPlugin,
  marksAreUniform,
  WORD_COMMIT_DELIMITER,
  type AutocorrectRule,
  type AutocorrectState,
} from './autocorrect.js';
import { autoCapitalizeDecorator } from './auto-capitalize-plugin.js';

export interface CustomAutocorrectEntry {
  from: string;
  to: string;
}

const WORD_CHAR = /[\p{L}\p{N}'’]/u;
const ALL_LOWER = /^[^\p{Lu}]*$/u;

export interface CustomMatchHit {
  /** Offset of the matched literal within the scanned string. */
  start: number;
  /** What actually sits in the doc (the typed casing). */
  literal: string;
  /** The (case-adapted) expansion. */
  replacement: string;
}

/** Case-adapt `to` for an all-lowercase key matched case-insensitively:
 *  lower → as defined; First-cap → capitalize; ALL-CAPS → uppercase;
 *  anything else refuses (returns null). */
function adaptCase(typed: string, from: string, to: string): string | null {
  if (typed === from) return to;
  if (typed.toLowerCase() !== from) return null;
  if (typed.length > 1 && typed === typed.toUpperCase()) return to.toUpperCase();
  if (typed[0] === typed[0]!.toUpperCase() && typed.slice(1) === from.slice(1)) {
    return to.length ? to[0]!.toUpperCase() + to.slice(1) : to;
  }
  return null;
}

/**
 * The pure matcher: given the textblock's content BEFORE the caret (inline
 * atoms as U+FFFC) and the entry table, find the replacement. Longest key
 * wins; boundary rules per key shape. Exported for table tests.
 */
export function findCustomMatch(
  before: string,
  entries: readonly CustomAutocorrectEntry[],
): CustomMatchHit | null {
  const byLength = [...entries].sort((a, b) => b.from.length - a.from.length);
  for (const entry of byLength) {
    const { from, to } = entry;
    if (!from || from.length > before.length) continue;
    const literal = before.slice(before.length - from.length);
    const replacement = ALL_LOWER.test(from)
      ? adaptCase(literal, from, to)
      : literal === from
        ? to
        : null;
    if (replacement === null) continue;
    const start = before.length - from.length;
    if (start > 0) {
      const prev = before[start - 1]!;
      if (WORD_CHAR.test(from[0]!)) {
        // Word-led key: needs a word boundary before it.
        if (WORD_CHAR.test(prev)) continue;
      } else if (prev === from[0]) {
        // Punctuation-led key: refuse inside a run of its own lead char
        // (`----` + delimiter must not convert a trailing `--`).
        continue;
      }
    }
    return { start, literal, replacement };
  }
  return null;
}

/** Static reachability check for the settings table (and tests): warnings for
 *  an entry key that a char-triggered rule would consume while it's being
 *  typed, so the literal can never survive to be committed. Non-blocking —
 *  the user may intend to toggle the other feature off. */
export function entryConflictWarnings(
  from: string,
  s: { smartQuotes: boolean; customDashEnabled: boolean; customDashTrigger: string },
): string[] {
  const warnings: string[] = [];
  if (s.smartQuotes && /['"]/.test(from)) {
    warnings.push(
      "May never fire while Smart quotes is on — straight quotes convert as you type them.",
    );
  }
  if (s.customDashEnabled && from.includes('-'.repeat(s.customDashTrigger.length))) {
    warnings.push(
      `Can never fire while Custom dash uses the ${s.customDashTrigger} trigger — the dash converts first.`,
    );
  }
  return warnings;
}

export const customAutocorrectKey = new PluginKey<AutocorrectState>('pmd-custom-autocorrect');

const customAutocorrectRule: AutocorrectRule = {
  triggers: (text) => WORD_COMMIT_DELIMITER.test(text),
  enabled: () =>
    settings.get('customAutocorrectEnabled') && settings.get('customAutocorrects').length > 0,
  match(state, from, _to, text) {
    const $from = state.doc.resolve(from);
    if (!$from.parent.isTextblock) return null;
    const before = $from.parent.textBetween(0, $from.parentOffset, undefined, '￼');
    const hit = findCustomMatch(before, settings.get('customAutocorrects'));
    if (!hit) return null;
    const seqFrom = from - (before.length - hit.start);
    if (!marksAreUniform(state.doc, seqFrom, from)) return null;
    return { replaceFrom: seqFrom, insert: hit.replacement + text, revertTo: hit.literal + text };
  },
};

export function customAutocorrectPlugin(): Plugin<AutocorrectState> {
  return makeAutocorrectPlugin(customAutocorrectKey, [customAutocorrectRule], [
    autoCapitalizeDecorator,
  ]);
}
