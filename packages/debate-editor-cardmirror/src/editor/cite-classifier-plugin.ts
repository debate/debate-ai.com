/**
 * Cite classifier plugin.
 *
 * Keeps the type of every paragraph-like node in sync with its inline
 * content: if any text run carries `cite_mark`, the node should be a
 * `cite_paragraph`; otherwise it should be `card_body` (inside a card)
 * or `paragraph` (at doc level). Same rule the importer uses, applied
 * to every dispatched transaction so paste / split / type edits stay
 * classified.
 *
 * Motivating cases:
 *   - Pasting a cite paragraph via the OS clipboard often arrives as
 *     inline content inside the destination paragraph. Without the
 *     promotion the destination stays `card_body` even though it
 *     visually reads as a cite.
 *   - Pressing Enter in the middle of a cite_paragraph: ProseMirror's
 *     splitBlock keeps both halves the same type, so the post-split
 *     paragraph stays `cite_paragraph` even if its content has no
 *     cite_mark. The demote half of the rule fixes that.
 *
 */

import { Plugin } from 'prosemirror-state';
import type { Transaction } from 'prosemirror-state';
import type { Node as PMNode } from 'prosemirror-model';
import { schema } from '../schema/index.js';
import { changedRange } from './transaction-utils.js';
import { guardNormalizerTr } from './normalizer-guard.js';

const CANDIDATE_TYPES = new Set<string>(['card_body', 'paragraph', 'cite_paragraph']);

export const citeClassifierPlugin: Plugin = new Plugin({
  appendTransaction(transactions, _oldState, newState) {
    // Scope to the mapped range of the dispatched changes. Walking
    // the full doc on every keystroke is O(N), which dominates
    // typing latency on large workspaces. `nodesBetween` still
    // surfaces the candidate textblock's parent, which is what
    // `targetTypeFor` needs.
    const range = changedRange(transactions);
    if (!range) return null;

    let tr: Transaction | null = null;
    // try/catch: on a schema-INVALID doc (a paste fitter can close a
    // destination card as an empty shell mid-dispatch — Issue #34)
    // the position walk itself throws, which would abort the whole
    // dispatch BEFORE the container-integrity normalizer can heal the
    // wound. Skip this round instead; the classifier re-runs on the
    // healed doc next round.
    try {
      newState.doc.nodesBetween(range.from, range.to, (node, pos, parent) => {
        const name = node.type.name;
        if (!CANDIDATE_TYPES.has(name)) return true;
        if (!parent) return false;
        const target = targetTypeFor(node, parent);
        if (target === null || target === name) return false;
        if (!tr) tr = newState.tr;
        tr.setNodeMarkup(pos, schema.nodes[target]!);
        return false;
      });
    } catch (err) {
      console.warn('[cite-classifier] skipped round on invalid doc:', err);
      return null;
    }

    return tr === null ? null : guardNormalizerTr(transactions, tr);
  },
});

/**
 * What type SHOULD this paragraph be, given its parent context and its
 * inline content? Returns `null` for parent contexts the classifier
 * doesn't touch (e.g. a `paragraph` inside a `table_cell`, where
 * `cite_paragraph` isn't legal content).
 */
function targetTypeFor(node: PMNode, parent: PMNode): string | null {
  const cite = hasCiteMark(node);
  const parentName = parent.type.name;
  if (parentName === 'card' || parentName === 'analytic_unit') {
    return cite ? 'cite_paragraph' : 'card_body';
  }
  if (parentName === 'doc') {
    return cite ? 'cite_paragraph' : 'paragraph';
  }
  // Other parents (e.g. `table_cell`) — don't touch.
  return null;
}

function hasCiteMark(node: PMNode): boolean {
  let has = false;
  node.descendants((child) => {
    if (has) return false;
    if (
      child.isText &&
      // Whitespace-only runs don't count: imported cut docs carry the
      // cite style on shrunk inter-word spaces deep into body text —
      // debris, not a cite line (same rule as the importer).
      child.text?.trim() &&
      child.marks.some((m) => m.type.name === 'cite_mark')
    ) {
      has = true;
    }
    return undefined;
  });
  return has;
}
