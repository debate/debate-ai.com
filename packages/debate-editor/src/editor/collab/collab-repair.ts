/**
 * The tables/cards repair pass, wired into sessions (§4.4).
 *
 * `buildDocRepairTr` (doc-repair.ts, M0) is the deterministic, pure,
 * idempotent repair: prosemirror-tables' `fixTables` for ragged rows
 * and colspan overflow (the row-insert-vs-column-insert merge), the
 * mutually-exclusive-marks sweep, and the container first-child
 * invariant (a `card` opens with a `tag`, an `analytic_unit` with an
 * `analytic`). This plugin runs it after every remote batch and every
 * undo/redo, leader-gated per §4.3:
 *
 *   - LEADER (lowest peer id among self + presence-visible peers)
 *     dispatches the repair; followers suppress theirs and receive the
 *     leader's synced fix within a round-trip. Structural repairs are
 *     insertions — two peers repairing the same merged state emit
 *     concurrent ops with distinct identities, and CRDTs do not dedupe
 *     semantically identical content (double-padded tables).
 *   - The gate is BEST-EFFORT: presence can be empty (cursors setting
 *     off, frames lost), making everyone leader. That degrades to
 *     churn, not corruption — the repair is idempotent on its own
 *     output and the normalizer round cap stops any dispatch loop.
 *   - Heal-sentinel canonicalization deliberately runs on EVERY peer
 *     (inside buildMarkRepairTr), NOT leader-gated: it is convergent
 *     under concurrency (same-value id rewrites; concurrent head
 *     write-backs are absorbed by the materializer's multi-head
 *     normalization), and all-peer write-back shrinks the
 *     mixed-version window in which an old client can still finalize
 *     a dropped card.
 *
 * Repair transactions carry the normalizer origin (read mode admits
 * them; the round cap applies) and sync like ordinary edits.
 */

import { Plugin } from 'prosemirror-state';
import { postNotice } from '../status-notices.js';
import type { Transaction } from 'prosemirror-state';
import { loroSyncPluginKey, loroUndoPluginKey } from 'loro-prosemirror';
import { buildDocRepairTr, buildMarkRepairTr } from '../../doc-repair.js';
import { guardNormalizerTr } from '../normalizer-guard.js';

function isBindingTransaction(tr: Transaction): boolean {
  return tr.getMeta(loroSyncPluginKey) !== undefined || tr.getMeta(loroUndoPluginKey) !== undefined;
}

/** Rate-limited notice that a merge hollowed a container and the heal
 *  restored it (the loro-prosemirror patch's display-layer heal marks
 *  the synthesized head with a 'crdt-heal-' id). Without this the
 *  repair is invisible — the old behavior silently DELETED the card,
 *  and users deserve to know a conflict was patched over. */
/** Scan cooldown — kept even though the notice itself coalesces:
 *  the heal-sentinel doc walk below is gated on this timestamp
 *  (perf study 2026-08-06: one full-doc traversal per remote frame
 *  otherwise), so the rate limit still earns its keep as a scan
 *  gate rather than a toast gate. */
let lastHealToastAt = 0;
function noteHealedMerge(): void {
  lastHealToastAt = Date.now();
  // Chip entry (coalescing) instead of a rate-limited toast: this is
  // a your-document-changed notice the user must be able to re-read.
  postNotice({
    severity: 'warning',
    title: 'Co-editing merge repaired',
    body:
      'A co-editing merge conflict left a card without its heading — it was kept, with a blank heading. '
      + 'Delete the blank heading if the card itself was meant to go.',
    key: 'collab-merge-heal',
  });
}

export function collabRepairPlugin(isLeader: () => boolean): Plugin {
  return new Plugin({
    appendTransaction(trs, oldState, newState) {
      if (!trs.some((tr) => tr.docChanged && isBindingTransaction(tr))) return null;
      // Surface display-layer merge heals (every peer sees its own).
      // Gated by the toast's own 60s cooldown: a sentinel found during
      // the cooldown would be dropped by noteHealedMerge AND
      // canonicalized away in this same pass — it could never toast
      // later — so skipping the walk during cooldown is
      // behavior-identical, minus one full-doc traversal per remote
      // frame (perf study 2026-08-06).
      if (Date.now() - lastHealToastAt >= 60_000) {
        newState.doc.descendants((node) => {
          if (node.type.name === 'tag' || node.type.name === 'analytic') {
            if (String(node.attrs['id'] ?? '').startsWith('crdt-heal-')) noteHealedMerge();
            return false;
          }
          return true;
        });
      }
      // The exclusive-marks resolution runs on EVERY peer: it's
      // mark-level and deterministic (every peer picks the same winner
      // via the schema-derived total order), so double-application
      // converges under LWW — and a follower must not hold a
      // schema-invalid underline+emphasis run waiting on the leader's
      // fix to arrive. The STRUCTURAL half (tables + container
      // first-child) stays leader-gated: those are insertions, and two
      // peers repairing the same merged state emit concurrent ops with
      // distinct identities that would duplicate content.
      // oldState → prosemirror-tables' bounded fast path (see
      // buildDocRepairTr); the mark/sentinel sweeps inside are
      // unchanged.
      const tr = isLeader() ? buildDocRepairTr(newState, oldState) : buildMarkRepairTr(newState);
      if (!tr) return null;
      return guardNormalizerTr(trs, tr);
    },
  });
}

/** §4.3 leader rule: lowest peer id wins, comparing self against the
 *  presence-visible peers. Peer ids are decimal u64 strings — compare
 *  numerically via BigInt, not lexically. */
export function lowestPeerIsLeader(selfPeerId: string, visible: string[]): boolean {
  try {
    const self = BigInt(selfPeerId);
    for (const p of visible) {
      if (BigInt(p) < self) return false;
    }
    return true;
  } catch {
    return true; // malformed peer id in presence — repair locally (safe)
  }
}
