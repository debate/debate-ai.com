/**
 * Shared Word-style autocorrect engine.
 *
 * One mechanism, many rules: a rule watches `handleTextInput` for a trigger
 * character, inspects the document context, and replaces a range ending at
 * the typed character with its output. The engine owns everything the rules
 * used to duplicate (smart quotes and the custom dash were line-for-line
 * clones of each other, 2026-07-13 review):
 *
 *  - the conversion transaction (replacement + caret placement + meta),
 *  - the one-shot Backspace-revert window: pressing Backspace immediately
 *    after a conversion restores the literal text instead of deleting
 *    (Word parity). The window is tracked in plugin state and ends at the
 *    next DOC or SELECTION change — deliberately NOT at meta-only
 *    transactions (collab cursor leases, spellcheck results, numbering
 *    refreshes), which used to silently kill the window milliseconds after
 *    a conversion in busy sessions,
 *  - the revert's safety checks: caret exactly after the conversion, and
 *    the document still holding exactly the inserted text (compared against
 *    the string captured at conversion time, so a mid-window settings
 *    change can never revert to the wrong literal).
 *
 * Rule positions never go stale: any transaction that could move content
 * (docChanged) or the caret (selectionSet) closes the window, and meta-only
 * transactions by definition move neither.
 *
 * DESIGNED FOR MORE RULES. Planned consumers beyond quotes/dashes:
 * user-defined text replacements (fire on a word delimiter, replace the
 * word before it; `revertTo` = the literal word + delimiter) and
 * auto-capitalization (fire on a letter or delimiter, uppercase a range).
 * Both fit this shape: `triggers` is the cheap per-keystroke gate, `match`
 * does the context inspection, and multiple rules can share one plugin
 * instance (first enabled match wins, in rule order).
 */

import { Plugin, PluginKey, TextSelection } from 'prosemirror-state';
import type { EditorState } from 'prosemirror-state';
import type { Node as PMNode } from 'prosemirror-model';

export interface AutocorrectMatch {
  /** Replacement range start — may reach back BEFORE the typed character to
   *  consume prior context (the dash trigger's earlier hyphens). The range
   *  always ends at the input's `to`. */
  replaceFrom: number;
  /** Text inserted over the range (marks are inherited from the replaced
   *  range / stored marks, standard insertText semantics). */
  insert: string;
  /** The literal text the Backspace-revert restores. */
  revertTo: string;
}

/** Post-match transform: runs after a rule matched, before the conversion
 *  dispatches. May adjust ONLY `insert` (revertTo must stay the literal the
 *  user typed, so one Backspace unwinds the whole stack of effects). This is
 *  how orthogonal corrections compose on one keystroke — auto-capitalization
 *  decorating a custom text replacement ("fwk" → "Framework" at a tag's
 *  sentence start) without the rules knowing about each other. */
export type AutocorrectDecorator = (
  state: EditorState,
  m: AutocorrectMatch,
  to: number,
  text: string,
) => AutocorrectMatch;

/** Delimiters that COMMIT the word/sequence before the caret — the trigger
 *  set for word-level rules (auto-capitalization, custom replacements).
 *  Quotes are deliberately absent (smart-quotes territory); Enter can never
 *  appear (keydown, not text input). */
export const WORD_COMMIT_DELIMITER = /^[ .,;:!?]$/;

/** Whole-range replacement inherits `marksAcross` — uniform marks round-trip
 *  exactly; mixed marks would collapse to the common subset, eating partial
 *  marking. Word-level rules skip non-uniform ranges (conservative no-fire). */
export function marksAreUniform(doc: PMNode, from: number, to: number): boolean {
  let first: readonly unknown[] | null = null;
  let uniform = true;
  doc.nodesBetween(from, to, (node) => {
    if (!uniform || !node.isText) return uniform;
    if (first === null) first = node.marks;
    else if (
      node.marks.length !== first.length ||
      !node.marks.every((mk, idx) => mk.eq(first![idx] as never))
    ) {
      uniform = false;
    }
    return uniform;
  });
  return uniform;
}

export interface AutocorrectRule {
  /** Cheap first gate: can this typed text ever trigger the rule? Runs on
   *  every keystroke — keep it a character comparison. */
  triggers(text: string): boolean;
  enabled(): boolean;
  /** Full context inspection; null = no conversion. `from`/`to` are the
   *  handleTextInput range (`to` > `from` when typing over a selection). */
  match(state: EditorState, from: number, to: number, text: string): AutocorrectMatch | null;
}

export interface AutocorrectState {
  undo: { from: number; to: number; inserted: string; revertTo: string } | null;
}

interface ConvertMeta {
  type: 'converted';
  from: number;
  to: number;
  inserted: string;
  revertTo: string;
}

export function makeAutocorrectPlugin(
  key: PluginKey<AutocorrectState>,
  rules: readonly AutocorrectRule[],
  decorators: readonly AutocorrectDecorator[] = [],
): Plugin<AutocorrectState> {
  return new Plugin<AutocorrectState>({
    key,
    state: {
      init: () => ({ undo: null }),
      apply(tr, prev): AutocorrectState {
        const meta = tr.getMeta(key) as ConvertMeta | undefined;
        if (meta?.type === 'converted') {
          return {
            undo: { from: meta.from, to: meta.to, inserted: meta.inserted, revertTo: meta.revertTo },
          };
        }
        if (prev.undo === null) return prev;
        // The revert window ends when content or the caret moves — NOT on
        // meta-only transactions, which move neither (so the stored range
        // stays valid for exactly as long as the window is open).
        return tr.docChanged || tr.selectionSet ? { undo: null } : prev;
      },
    },
    props: {
      handleTextInput(view, from, to, text) {
        for (const rule of rules) {
          if (!rule.triggers(text)) continue;
          if (!rule.enabled()) continue;
          let m = rule.match(view.state, from, to, text);
          if (!m) continue;
          for (const decorate of decorators) m = decorate(view.state, m, to, text);
          const tr = view.state.tr.insertText(m.insert, m.replaceFrom, to);
          const end = m.replaceFrom + m.insert.length;
          tr.setSelection(TextSelection.create(tr.doc, end));
          tr.setMeta(key, {
            type: 'converted',
            from: m.replaceFrom,
            to: end,
            inserted: m.insert,
            revertTo: m.revertTo,
          } satisfies ConvertMeta);
          view.dispatch(tr.scrollIntoView());
          return true;
        }
        return false;
      },
      handleKeyDown(view, event) {
        if (event.key !== 'Backspace') return false;
        if (event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return false;
        const st = key.getState(view.state);
        if (!st?.undo) return false;
        const { from, to, inserted, revertTo } = st.undo;
        const sel = view.state.selection;
        // Only when the caret sits exactly after the conversion…
        if (!sel.empty || sel.from !== to) return false;
        // …and the document still holds exactly what was inserted.
        if (view.state.doc.textBetween(from, to) !== inserted) return false;
        const tr = view.state.tr.insertText(revertTo, from, to);
        tr.setSelection(TextSelection.create(tr.doc, from + revertTo.length));
        view.dispatch(tr.scrollIntoView());
        return true;
      },
    },
  });
}
