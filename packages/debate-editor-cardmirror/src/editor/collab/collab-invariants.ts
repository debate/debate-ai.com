/**
 * Session-mode invariant heal for formatting fusion.
 *
 * Peritext range marks cover text concurrently inserted INSIDE their
 * range: a partner's underlined typing inside a span this peer shrank
 * while offline inherits the small `font_size` at merge, on both
 * replicas, with no op recording it. Loro's UndoManager compounds this
 * by re-marking drifted ranges across interleaved remote ops. Neither
 * path can be prevented at the CRDT layer (`expand` config governs
 * boundaries only, not interiors), so the fusion is healed after the
 * fact — and the fused copies always carry the enclosing mark's exact
 * attrs, which is what makes provenance-gated healing sound.
 *
 * The rule: strip `font_size` only where BOTH hold —
 *   1. `attrs.origin === 'shrink'` (applied by the protection-aware
 *      sizing machinery, which never targets protected runs itself), and
 *   2. the run carries an underline/emphasis mark (underlined = read =
 *      must stay readable; promotion commands enforce the same policy).
 * Sizes the user chose (size chip, ± nudge, pasted content — all
 * `origin: null`) are never touched, however they end up layered.
 *
 * Runs only on the Loro binding's transactions (remote imports, the
 * init-time content replace, undo/redo): local commands maintain the
 * invariant themselves, and fused runs are shrink-EXEMPT — protection
 * reads the underline and skips them — so without this pass the stuck
 * size cannot even be cleared by regrow.
 */
import { Plugin } from 'prosemirror-state';
import type { Transaction } from 'prosemirror-state';
import type { Node as PMNode } from 'prosemirror-model';
import { AddMarkStep, RemoveMarkStep } from 'prosemirror-transform';
import { loroSyncPluginKey, loroUndoPluginKey } from 'loro-prosemirror';
import { markSyncOrigin } from '../sync-origin.js';

/** Same set the shrink cycle exempts (`SHRINK_EXEMPT_MARK_NAMES`). */
const FUSION_PROTECTED_MARK_NAMES = new Set([
  'underline_mark',
  'underline_direct',
  'emphasis_mark',
]);

function isBindingTransaction(tr: Transaction): boolean {
  return tr.getMeta(loroSyncPluginKey) !== undefined || tr.getMeta(loroUndoPluginKey) !== undefined;
}

interface Range {
  from: number;
  to: number;
}

/** Doc ranges `tr` touched, in `tr`'s post-apply coordinates. Replace
 *  steps report through their step maps; mark steps have EMPTY maps, so
 *  their spans are read off the step and mapped past later steps. */
function changedRanges(tr: Transaction): Range[] {
  const out: Range[] = [];
  tr.steps.forEach((step, i) => {
    const rest = tr.mapping.slice(i + 1);
    if (step instanceof AddMarkStep || step instanceof RemoveMarkStep) {
      out.push({ from: rest.map(step.from, -1), to: rest.map(step.to, 1) });
      return;
    }
    step.getMap().forEach((_oldStart, _oldEnd, newStart, newEnd) => {
      out.push({ from: rest.map(newStart, -1), to: rest.map(newEnd, 1) });
    });
  });
  return out;
}

export function collabInvariantHealPlugin(): Plugin {
  return new Plugin({
    appendTransaction(trs, _oldState, newState) {
      const ranges: Range[] = [];
      for (let i = 0; i < trs.length; i++) {
        if (!isBindingTransaction(trs[i]!)) continue;
        // Map this tr's ranges through every LATER tr in the batch so
        // they address `newState.doc`.
        for (const r of changedRanges(trs[i]!)) {
          let { from, to } = r;
          for (let j = i + 1; j < trs.length; j++) {
            from = trs[j]!.mapping.map(from, -1);
            to = trs[j]!.mapping.map(to, 1);
          }
          if (from < to) ranges.push({ from, to });
        }
      }
      if (ranges.length === 0) return null;

      const fontSizeType = newState.schema.marks['font_size'];
      if (!fontSizeType) return null;
      const tr = newState.tr;
      const doc = newState.doc;
      const healed = new Set<number>(); // text-node start positions, dedup across overlapping ranges
      for (const { from, to } of ranges) {
        const clampedFrom = Math.max(0, Math.min(from, doc.content.size));
        const clampedTo = Math.max(clampedFrom, Math.min(to, doc.content.size));
        doc.nodesBetween(clampedFrom, clampedTo, (node: PMNode, pos: number) => {
          if (!node.isText || healed.has(pos)) return true;
          const fs = node.marks.find((m) => m.type === fontSizeType);
          if (!fs || fs.attrs['origin'] !== 'shrink') return true;
          if (!node.marks.some((m) => FUSION_PROTECTED_MARK_NAMES.has(m.type.name))) return true;
          healed.add(pos);
          tr.removeMark(pos, pos + node.nodeSize, fontSizeType);
          return true;
        });
      }
      if (tr.steps.length === 0) return null;
      // Machinery, not a user edit: read mode and the AI coordinator
      // must admit it (both peers emit the identical unmark, so the
      // heal converges regardless of who applies first).
      return markSyncOrigin(tr);
    },
  });
}
