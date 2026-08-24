/**
 * Custom dash autoformat, gated on the `customDash*` settings (default off).
 *
 * As you type the last hyphen of the configured trigger (`---` classic, or
 * `--`), it's replaced with the configured dash output (en/em dash, with or
 * without surrounding spaces). The `--` trigger fires on the second hyphen,
 * so it cannot tell a forthcoming `---` apart — acceptable only because the
 * user opts into that trigger explicitly. Neither trigger fires mid-hyphen-run
 * (e.g. after pasted hyphens or ASCII rules), so only a clean sequence
 * converts. (The run guard originally protected only `--`; `---` gained it in
 * the 2026-07-13 review — a hyphen typed at the end of `----` used to convert
 * the trailing three.)
 *
 * Conversion mechanics + the Backspace-revert window live in the shared
 * autocorrect engine (autocorrect.ts) — this module is just the rule. The
 * revert restores the trigger as configured AT CONVERSION TIME (captured in
 * `revertTo`), so a settings change inside the revert window can't restore
 * the wrong literal.
 */

import { PluginKey } from 'prosemirror-state';
import type { Plugin } from 'prosemirror-state';
import { settings } from './settings.js';
import type { Settings } from './settings.js';
import { makeAutocorrectPlugin, type AutocorrectRule, type AutocorrectState } from './autocorrect.js';

/** The literal string each dash style produces. Spaced variants use a regular
 *  space on each side. */
const DASH_OUTPUT: Record<Settings['customDashStyle'], string> = {
  en: '–',
  'en-spaced': ' – ',
  em: '—',
  'em-spaced': ' — ',
};

/** The output string for the current `customDashStyle`. Exported for tests. */
export function dashOutput(): string {
  return DASH_OUTPUT[settings.get('customDashStyle')];
}

export const customDashKey = new PluginKey<AutocorrectState>('pmd-custom-dash');

const customDashRule: AutocorrectRule = {
  triggers: (text) => text === '-',
  enabled: () => settings.get('customDashEnabled'),
  match(state, from, _to, _text) {
    const $from = state.doc.resolve(from);
    const trigger = settings.get('customDashTrigger');
    // Need trigger.length - 1 hyphens immediately before this one
    // (within the textblock) so this keystroke completes the trigger.
    const need = trigger.length - 1;
    if ($from.parentOffset < need) return null;
    if (state.doc.textBetween(from - need, from) !== '-'.repeat(need)) return null;
    // Don't convert inside a longer hyphen run (pasted hyphens, ASCII art) —
    // only a clean sequence fires.
    if ($from.parentOffset > need && state.doc.textBetween(from - need - 1, from - need) === '-') {
      return null;
    }
    return { replaceFrom: from - need, insert: dashOutput(), revertTo: trigger };
  },
};

export function customDashPlugin(): Plugin<AutocorrectState> {
  return makeAutocorrectPlugin(customDashKey, [customDashRule]);
}
