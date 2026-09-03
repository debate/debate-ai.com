/**
 * Small helpers shared across plugins that need to scope their work
 * to the regions of the doc that actually moved in the current
 * dispatch. Walking the full doc on every transaction is the
 * dominant per-keystroke cost in large workspaces; restricting to
 * `tr.steps`' mapped ranges keeps editing O(1) regardless of doc
 * size for the common typing case.
 */

import type { Transaction } from 'prosemirror-state';
import { AddMarkStep, RemoveMarkStep } from 'prosemirror-transform';

/**
 * Union of every step's affected range in the new doc, across the
 * given transactions. Returns `null` when none of the transactions
 * changed the doc.
 *
 * For structural steps (ReplaceStep, etc.), the range comes from
 * `Step.getMap().forEach` (which yields `(oldFrom, oldTo, newFrom,
 * newTo)`; we collect the new-side bounds because the walk happens
 * against the post-state doc).
 *
 * For mark steps (AddMarkStep / RemoveMarkStep), `getMap` returns
 * `StepMap.empty` — the step doesn't shift any positions — so
 * `forEach` yields nothing. Callers like `cite-classifier-plugin`
 * and `named-style-normalizer-plugin` care about mark changes
 * (a cite_mark add should promote the containing paragraph to
 * `cite_paragraph`), so we extract the mark step's
 * `from`/`to` directly and contribute those to the union too.
 */
export function changedRange(
  transactions: readonly Transaction[],
): { from: number; to: number } | null {
  let from = Infinity;
  let to = -Infinity;
  const expand = (lo: number, hi: number): void => {
    if (lo < from) from = lo;
    if (hi > to) to = hi;
  };
  for (const tr of transactions) {
    if (!tr.docChanged) continue;
    for (let i = 0; i < tr.steps.length; i++) {
      const step = tr.steps[i]!;
      // Subsequent steps' mappings shift earlier steps' coordinates
      // forward into the final state. For a single-step tr this is
      // a no-op slice; for multi-step trs (send-to-speech, structural
      // edits) it keeps the range valid in the final doc.
      const subMapping = tr.mapping.slice(i + 1);
      const stepMap = step.getMap();
      stepMap.forEach((_oldFrom, _oldTo, newFrom, newTo) => {
        expand(subMapping.map(newFrom, -1), subMapping.map(newTo, 1));
      });
      // Mark-only steps have an empty stepMap, so the loop above
      // contributes nothing; surface their explicit from/to (see the
      // JSDoc above for why mark changes must count).
      if (step instanceof AddMarkStep || step instanceof RemoveMarkStep) {
        expand(subMapping.map(step.from, -1), subMapping.map(step.to, 1));
      }
    }
  }
  if (from === Infinity) return null;
  return { from, to };
}
