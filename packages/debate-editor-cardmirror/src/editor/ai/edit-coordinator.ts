/**
 * AI edit coordinator.
 *
 * AI operations apply their edits *after* an async model call. Between
 * capturing where an edit should land and dispatching it, the document
 * can move underneath them — another AI op finishing, or the user typing
 * — so positions captured up front drift and edits land in the wrong
 * place. This coordinator fixes that with **edit leases**.
 *
 * A lease claims a document region for the lifetime of one AI op. The
 * plugin holds every live lease's positions and **remaps them through
 * `tr.mapping` on every transaction**, so a lease tracks its content as
 * the doc changes around it (the same technique the comments marks and
 * the voice plugin use). Two guarantees fall out, and together they make
 * placement correct:
 *
 *   - Edits *outside* a lease → the lease remaps. The op reads
 *     `lease.region()` at apply time instead of stale offsets, so other
 *     AI ops and user edits elsewhere shift it correctly.
 *   - Edits *inside* a lease → blocked. `filterTransaction` rejects any
 *     user transaction that changes the region's content — text, inline
 *     marks, or node attrs — inside a live lease (the op's own writes carry
 *     a bypass meta). This keeps an op's content plan valid: nobody can
 *     retype, re-style, or re-mark inside the region mid-flight.
 *
 * Sync-origin transactions (already-merged remote content) are the one
 * exception to the inside-a-lease block: they cannot be rejected without
 * desynchronizing the editor from the shared doc, so an overlapping sync
 * edit instead *releases* the touched lease — the op's content plan is
 * stale against the merged text, and the owning feature already treats a
 * vanished lease as "abort and retry".
 *
 * Because leases remap, disjoint ops run concurrently; overlapping claims
 * are rejected (`claimRegion` returns null and the caller aborts). When a
 * user edit is blocked, the touched lease region flashes.
 *
 * View-only: leases are plugin state, never marks, never serialized.
 * Register / release / flash are meta-only transactions tagged
 * `addToHistory: false`, so they add no undo steps.
 */

import { Plugin, PluginKey } from 'prosemirror-state';
import type { EditorState, Transaction } from 'prosemirror-state';
import { Decoration, DecorationSet, type EditorView } from 'prosemirror-view';
import { isSyncOrigin } from '../sync-origin.js';

export interface CoordRange {
  from: number;
  to: number;
}

interface LeaseRecord {
  id: string;
  label: string;
  /** positions[0] = region.from, positions[1] = region.to, the rest are
   *  optional interior points the caller registered. All remapped each tr. */
  positions: number[];
}

interface CoordState {
  leases: LeaseRecord[];
  flash: CoordRange[];
}

type Meta =
  | { t: 'register'; lease: LeaseRecord }
  | { t: 'release'; id: string }
  | { t: 'flash'; ranges: CoordRange[] }
  | { t: 'clearFlash' };

const coordinatorKey = new PluginKey<CoordState>('ai-edit-coordinator');
/** Separate key so the bypass tag composes with a feature's own metas. */
const bypassKey = new PluginKey('ai-edit-coordinator-bypass');

const EMPTY: CoordState = { leases: [], flash: [] };
const FLASH_MS = 450;
let leaseCounter = 0;

/** Tag a transaction as an AI write so the block predicate lets it through.
 *  Does NOT touch `addToHistory` — an AI content edit stays undoable (the
 *  feature controls that); only the coordinator's own bookkeeping
 *  transactions add the off-history meta, and those carry no steps anyway. */
function markBypass(tr: Transaction): Transaction {
  return tr.setMeta(bypassKey, true);
}

function isBypass(tr: Transaction): boolean {
  return tr.getMeta(bypassKey) === true;
}

/** True when a non-bypass transaction would change content *inside* any
 *  live lease — length change at the interior, or a deleted boundary. */
/** Live leased ranges (remapped positions), for advisory surfaces —
 *  the collab session advertises them to the partner ("AI is editing
 *  here", §4.6 non-enforcing). Read-only over the plugin state. */
export function leasedRanges(state: EditorState): CoordRange[] {
  return (coordinatorKey.getState(state)?.leases ?? []).map((l) => ({
    from: l.positions[0]!,
    to: l.positions[1]!,
  }));
}

export function coordinatorBlocks(state: EditorState, tr: Transaction): boolean {
  if (!tr.docChanged || isBypass(tr) || isSyncOrigin(tr)) return false;
  const cs = coordinatorKey.getState(state);
  if (!cs || cs.leases.length === 0) return false;
  return cs.leases.some((l) => leaseTouched(tr, l));
}

function leaseTouched(tr: Transaction, lease: LeaseRecord): boolean {
  const from = lease.positions[0]!;
  const to = lease.positions[1]!;
  const rf = tr.mapping.mapResult(from, 1);
  const rt = tr.mapping.mapResult(to, -1);
  // A boundary deleted out from under the region → touched.
  if (rf.deleted || rt.deleted) return true;
  const f = rf.pos;
  const t = rt.pos;
  // Content length changed inside the region → touched (fast path).
  if (t - f !== to - from) return true;
  // Same length: still touched if the region's CONTENT changed — inline marks,
  // node attrs, or same-length text. Length/position mapping alone can't see a
  // mark or style application (those produce identity step maps), so compare the
  // region's slice before vs. after.
  return !tr.before.slice(from, to).eq(tr.doc.slice(f, t));
}

export const editCoordinatorPlugin = new Plugin<CoordState>({
  key: coordinatorKey,
  state: {
    init: () => EMPTY,
    apply(tr, prev) {
      let leases = prev.leases;
      let flash = prev.flash;
      if (tr.docChanged) {
        // A sync-origin edit inside a lease releases it (module doc):
        // the touched-check runs against pre-mapping positions, so it
        // must precede the remap below.
        if (isSyncOrigin(tr) && leases.length) {
          leases = leases.filter((l) => !leaseTouched(tr, l));
        }
        // region.from biases right, region.to biases left, so insertions
        // at the very edge stay *outside* the region; interior points keep
        // the default rightward bias.
        leases = leases
          .map((l) => ({
            ...l,
            positions: l.positions.map((p, i) => tr.mapping.map(p, i === 1 ? -1 : 1)),
          }))
          .filter((l) => l.positions[1]! > l.positions[0]!);
        if (flash.length) {
          flash = flash
            .map((r) => ({ from: tr.mapping.map(r.from, 1), to: tr.mapping.map(r.to, -1) }))
            .filter((r) => r.to > r.from);
        }
      }
      const meta = tr.getMeta(coordinatorKey) as Meta | undefined;
      if (meta) {
        switch (meta.t) {
          case 'register':
            leases = [...leases, meta.lease];
            break;
          case 'release':
            leases = leases.filter((l) => l.id !== meta.id);
            break;
          case 'flash':
            flash = meta.ranges;
            break;
          case 'clearFlash':
            flash = [];
            break;
        }
      }
      if (leases === prev.leases && flash === prev.flash) return prev;
      return { leases, flash };
    },
  },
  props: {
    decorations(state) {
      const cs = coordinatorKey.getState(state);
      if (!cs || cs.flash.length === 0) return null;
      return DecorationSet.create(
        state.doc,
        cs.flash.map((r) => Decoration.inline(r.from, r.to, { class: 'pmd-ai-locked-flash' })),
      );
    },
  },
  // Authoritative block: reject user content-edits inside a live lease.
  // (The shells also pre-check in dispatchTransaction so the rejection can
  // flash; this is the backstop that catches every other dispatch path.)
  filterTransaction(tr, state) {
    return !coordinatorBlocks(state, tr);
  },
});

/** Handle a feature holds for the duration of one AI op. */
export interface EditLease {
  readonly id: string;
  /** The live, remapped blocking region — or null if it was invalidated
   *  (collapsed to nothing). Read this at apply time, not a stored offset. */
  region(): CoordRange | null;
  /** All live, remapped positions: [from, to, ...points]. Null if gone. */
  positions(): number[] | null;
  /** Shift from any captured interior offset to its current position.
   *  Valid because edits inside the lease are blocked, so the whole region
   *  moves by one uniform delta. Returns null if the lease is invalidated. */
  delta(): number | null;
  /** Dispatch an AI write through this lease (tagged to bypass the block). */
  apply(tr: Transaction): void;
  release(): void;
}

/**
 * Claim `region` for an AI op. Returns null if it overlaps a live lease —
 * the caller should abort (a same-region op is already in flight). `points`
 * are extra interior offsets to track if the caller wants them remapped
 * individually (most callers use `delta()` instead).
 */
export function claimRegion(
  view: EditorView,
  region: CoordRange,
  opts: { label: string; points?: number[] },
): EditLease | null {
  const from = Math.min(region.from, region.to);
  const to = Math.max(region.from, region.to);
  const cs = coordinatorKey.getState(view.state) ?? EMPTY;
  // Reject an overlapping claim (zero-width point claims never overlap).
  for (const l of cs.leases) {
    if (from < l.positions[1]! && l.positions[0]! < to) return null;
  }
  const id = `lease-${++leaseCounter}`;
  const originFrom = from;
  const lease: LeaseRecord = { id, label: opts.label, positions: [from, to, ...(opts.points ?? [])] };
  try {
    view.dispatch(markBypass(view.state.tr.setMeta(coordinatorKey, { t: 'register', lease })));
  } catch {
    return null;
  }

  const find = (): LeaseRecord | undefined =>
    coordinatorKey.getState(view.state)?.leases.find((l) => l.id === id);

  return {
    id,
    region() {
      const l = find();
      return l ? { from: l.positions[0]!, to: l.positions[1]! } : null;
    },
    positions() {
      const l = find();
      return l ? l.positions.slice() : null;
    },
    delta() {
      const l = find();
      return l ? l.positions[0]! - originFrom : null;
    },
    apply(tr) {
      try {
        view.dispatch(markBypass(tr));
      } catch (err) {
        // ONLY view teardown is benign here (the doc/window closed
        // under an in-flight AI edit). Swallowing every error made
        // repair flows count a failed dispatch as applied and toast
        // success for edits that never landed (audit tier 4) —
        // anything else rethrows so the caller aborts its pass and
        // the global error surface reports it.
        if (view.isDestroyed) return;
        throw err;
      }
    },
    release() {
      try {
        view.dispatch(markBypass(view.state.tr.setMeta(coordinatorKey, { t: 'release', id })));
      } catch (err) {
        if (view.isDestroyed) return; // teardown — nothing to release
        throw err;
      }
    },
  };
}

/** Flash the lease region(s) a blocked transaction tried to edit (or all
 *  live leases when no transaction is given). Auto-clears after a beat. */
export function flashLockedLeases(view: EditorView, blockedBy?: Transaction): void {
  const cs = coordinatorKey.getState(view.state);
  if (!cs || cs.leases.length === 0) return;
  const hit = blockedBy ? cs.leases.filter((l) => leaseTouched(blockedBy, l)) : cs.leases;
  const ranges = (hit.length ? hit : cs.leases).map((l) => ({
    from: l.positions[0]!,
    to: l.positions[1]!,
  }));
  try {
    view.dispatch(markBypass(view.state.tr.setMeta(coordinatorKey, { t: 'flash', ranges })));
  } catch {
    return;
  }
  setTimeout(() => {
    try {
      view.dispatch(markBypass(view.state.tr.setMeta(coordinatorKey, { t: 'clearFlash' })));
    } catch {
      /* view torn down */
    }
  }, FLASH_MS);
}
