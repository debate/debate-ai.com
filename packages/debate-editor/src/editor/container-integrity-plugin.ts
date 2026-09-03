/**
 * Container-integrity normalizer (Issue #34, the headless-card wound).
 *
 * Two edit paths can land a schema-invalid container in the LIVE doc,
 * where it breaks keystrokes near it (`contentMatchAt` throws) and
 * trips the save-time heal on every journal write until the doc is
 * reopened:
 *
 *  1. Pasting a cut whose selection crossed out of one card into the
 *     next — `parseSlice` rebuilds closed nodes without validation and
 *     the paste fitter trusts slice interiors. transformPasted heals
 *     the SLICE side (paste-plugin.ts), but
 *  2. the fitter can also split the DESTINATION card and close its
 *     remainder as an empty `card()` — damage that only exists after
 *     the step applies, which no slice-side hook can see.
 *
 * So this plugin is the backstop for the whole wound class, whatever
 * produces it next: after any doc-changing transaction it walks the
 * containers and
 *   - deletes EMPTY cards / analytic_units (fitter split shells —
 *     nothing to conserve), and
 *   - prepends a blank head to a container missing one (the settled
 *     hollow-shell doctrine: "re-delete a blank tag occasionally
 *     beats deleting too much" — never drop or merge user content).
 *
 * Deterministic and self-extinguishing; routed through the normalizer
 * round guard like absorb/classifier so a normalizer fight can't
 * wedge the dispatch loop.
 */

import { Plugin } from 'prosemirror-state';
import { Fragment, type Node as PMNode } from 'prosemirror-model';
import { schema, newHeadingId } from '../schema/index.js';
import { guardNormalizerTr } from './normalizer-guard.js';

const HEAD_OF: Record<string, string> = { card: 'tag', analytic_unit: 'analytic' };

interface Wound {
  pos: number;
  node: PMNode;
  kind: 'empty' | 'headless';
}

function findWounds(doc: PMNode): Wound[] {
  const wounds: Wound[] = [];
  doc.descendants((node, pos) => {
    const head = HEAD_OF[node.type.name];
    if (!head) return true;
    if (node.childCount === 0) {
      wounds.push({ pos, node, kind: 'empty' });
    } else if (node.firstChild!.type.name !== head) {
      wounds.push({ pos, node, kind: 'headless' });
    }
    return false; // containers don't nest containers
  });
  return wounds;
}

export const containerIntegrityPlugin: Plugin = new Plugin({
  appendTransaction(transactions, _oldState, newState) {
    if (!transactions.some((t) => t.docChanged)) return null;
    const wounds = findWounds(newState.doc);
    if (wounds.length === 0) return null;
    const tr = newState.tr;
    // Bottom-up so earlier positions stay valid. Heals REPLACE the
    // wounded node with a rebuilt valid one — inserting INTO the
    // wound would call contentMatchAt on its invalid content, which
    // throws and aborts the whole dispatch.
    for (let i = wounds.length - 1; i >= 0; i--) {
      const w = wounds[i]!;
      if (w.kind === 'empty') {
        tr.delete(w.pos, w.pos + w.node.nodeSize);
        continue;
      }
      const headType = HEAD_OF[w.node.type.name]!;
      const headNode = schema.nodes[headType]!.create({ id: newHeadingId() });
      let healed: PMNode | null = null;
      try {
        healed = w.node.type.createChecked(
          w.node.attrs,
          Fragment.from([headNode]).append(w.node.content),
          w.node.marks,
        );
      } catch {
        // Invalid beyond the missing head — salvage the type-legal
        // children (same policy as the CRDT materializer's heal).
        try {
          const kept: PMNode[] = [headNode];
          let match = w.node.type.contentMatch.matchFragment(Fragment.from([headNode]));
          w.node.content.forEach((child) => {
            const next = match?.matchType(child.type);
            if (next) {
              kept.push(child);
              match = next;
            }
          });
          healed = w.node.type.createChecked(w.node.attrs, Fragment.fromArray(kept), w.node.marks);
        } catch (err) {
          console.warn('[container-integrity] unhealable container left in place:', err);
        }
      }
      if (healed) tr.replaceWith(w.pos, w.pos + w.node.nodeSize, healed);
    }
    if (!tr.steps.length) return null;
    return guardNormalizerTr(transactions, tr);
  },
});
