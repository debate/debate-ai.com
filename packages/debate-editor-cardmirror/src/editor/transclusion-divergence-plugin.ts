/**
 * Live-zone divergence indicator — the view layer (Feature 2).
 *
 * Holds the set of zone identities whose source has diverged (see
 * transclusion-divergence.ts) and paints a node decoration on each so the
 * NodeView can badge its glyph. The check reads sources off disk, so it's run
 * sparingly and only when it can help:
 *   - once when a document opens (`requestDivergenceCheck`), and
 *   - every ~10 minutes during a QUIET moment (an idle timer reset by edits),
 *   - never in read mode, never off the desktop (no file layer to read with).
 * The check never mutates the document — divergence is advisory; the fix is the
 * existing manual Refresh.
 */

import { Plugin, PluginKey } from 'prosemirror-state';
import { Decoration, DecorationSet, type EditorView } from 'prosemirror-view';
import type { Node as PMNode } from 'prosemirror-model';
import { isTransclusionNode, zoneIdentity } from './transclusion.js';
import { transclusionSupported } from './transclusion-resolve.js';
import { isInterDocZone, checkAllZoneDivergence, inDocDivergence } from './transclusion-divergence.js';
import { settings } from './settings.js';

/** Class a diverged zone's outer DOM (the NodeView wrapper) carries — the
 *  NodeView reads it (and PM applies it) to badge the glyph. */
export const ZONE_DIVERGED_CLASS = 'pmd-zone-diverged';

/** ~10 minutes: the quiet-moment recheck cadence. */
export const DIVERGENCE_IDLE_MS = 10 * 60 * 1000;

/** Short coalescing delay for the post-refresh recheck (so Refresh-All fires one
 *  recheck, not one per zone). */
const REFRESH_RECHECK_MS = 400;

/** Debounce for the in-doc copy divergence recheck — long enough not to run per
 *  keystroke, short enough that the badge appears soon after you stop typing. */
const IN_DOC_RECHECK_MS = 500;

/** Transaction meta a refresh stamps so this plugin re-checks promptly and
 *  clears the badge on the just-updated zone (see refreshZoneAtPos). */
export const ZONE_REFRESHED_META = 'pmdZoneRefreshed';

interface DivergenceState {
  diverged: Set<string>;
  decoSet: DecorationSet;
  /** Bumped by any refresh transaction — drives an immediate recheck. */
  refreshSeq: number;
}

export const transclusionDivergenceKey = new PluginKey<DivergenceState>('transclusionDivergence');

/** Node decorations marking every currently-present zone whose identity is in
 *  `diverged` — rebuilt whenever the doc or the diverged set changes. */
function buildDecoSet(doc: PMNode, diverged: Set<string>): DecorationSet {
  if (diverged.size === 0) return DecorationSet.empty;
  const decos: Decoration[] = [];
  doc.descendants((node, pos) => {
    if (!isTransclusionNode(node)) return true;
    if (isInterDocZone(node) && diverged.has(zoneIdentity(node))) {
      // class → CSS badge (auto-applied to the NodeView's DOM); spec.diverged →
      // the NodeView reads it to set the glyph title and the menu hint.
      decos.push(
        Decoration.node(pos, pos + node.nodeSize, { class: ZONE_DIVERGED_CLASS }, { diverged: true }),
      );
    }
    return false; // zones never nest
  });
  return DecorationSet.create(doc, decos);
}

function setsEqual(a: Set<string>, b: Set<string>): boolean {
  if (a.size !== b.size) return false;
  for (const v of a) if (!b.has(v)) return false;
  return true;
}

/** Effective read mode for THIS view. Read mode is per-pane in multi-doc
 *  mode — the shell keeps it on each DocRecord and deliberately ignores
 *  the global setting — so consulting `settings.readMode` here silently
 *  killed every pane's divergence check whenever the global flag was
 *  left on by a single-doc session (the missing-red-rail-in-multi-pane
 *  bug). Both shells stamp `pmd-read-mode` on the view's host element,
 *  so the DOM is the one answer honest in every shell; the setting is
 *  only the fallback for a view not (yet) in the document. */
function viewInReadMode(view: EditorView): boolean {
  if (view.dom.closest('.pmd-read-mode')) return true;
  return view.dom.isConnected ? false : settings.get('readMode');
}

/** Run a check now and, if the diverged set changed, publish it. No-op in read
 *  mode (this view's own — see viewInReadMode) / off-desktop. Shared by the
 *  on-open trigger and the idle scheduler. */
export async function requestDivergenceCheck(view: EditorView): Promise<void> {
  if (!transclusionSupported() || viewInReadMode(view)) return;
  const { diverged } = await checkAllZoneDivergence(view);
  const current = transclusionDivergenceKey.getState(view.state)?.diverged ?? new Set<string>();
  if (setsEqual(diverged, current)) return;
  view.dispatch(view.state.tr.setMeta(transclusionDivergenceKey, diverged));
}

export interface LiveZoneCheckSummary {
  /** False off-desktop, where sources can't be read. */
  desktop: boolean;
  /** Cross-file live zones present in the doc. */
  total: number;
  /** Sources actually read (reachable). */
  checked: number;
  /** Sources found changed since last pulled. */
  diverged: number;
}

/** Manually check every cross-file live zone's source for changes and update the
 *  badges — but pull NOTHING (that's Refresh). Runs even in read mode (it's an
 *  explicit, read-only action) and returns a summary for the caller to surface. */
export async function checkLiveZoneSources(view: EditorView): Promise<LiveZoneCheckSummary> {
  let total = 0;
  view.state.doc.descendants((node) => {
    if (!isTransclusionNode(node)) return true;
    if (isInterDocZone(node)) total++;
    return false; // zones never nest
  });
  if (!transclusionSupported()) return { desktop: false, total, checked: 0, diverged: 0 };
  const { diverged, checked } = await checkAllZoneDivergence(view);
  const current = transclusionDivergenceKey.getState(view.state)?.diverged ?? new Set<string>();
  if (!setsEqual(diverged, current)) {
    view.dispatch(view.state.tr.setMeta(transclusionDivergenceKey, diverged));
  }
  return { desktop: true, total, checked, diverged: diverged.size };
}

export function makeTransclusionDivergencePlugin(): Plugin<DivergenceState> {
  return new Plugin<DivergenceState>({
    key: transclusionDivergenceKey,
    state: {
      init: () => ({ diverged: new Set<string>(), decoSet: DecorationSet.empty, refreshSeq: 0 }),
      apply(tr, value, _old, newState) {
        const meta = tr.getMeta(transclusionDivergenceKey) as Set<string> | undefined;
        const diverged = meta ?? value.diverged;
        const refreshSeq = value.refreshSeq + (tr.getMeta(ZONE_REFRESHED_META) === true ? 1 : 0);
        // Rebuild decorations when the set changes or positions shift; otherwise
        // reuse — the identity-keyed set is stable across ordinary edits. (In-doc
        // divergence is folded in by a debounced recheck in view(), not here — it
        // must not run per keystroke.)
        if (meta || tr.docChanged) {
          return { diverged, decoSet: buildDecoSet(newState.doc, diverged), refreshSeq };
        }
        if (refreshSeq !== value.refreshSeq) return { ...value, refreshSeq };
        return value;
      },
    },
    props: {
      decorations(state) {
        return transclusionDivergenceKey.getState(state)?.decoSet ?? DecorationSet.empty;
      },
    },
    view(editorView) {
      let idle: ReturnType<typeof setTimeout> | null = null;
      let refreshTimer: ReturnType<typeof setTimeout> | null = null;
      let inDocTimer: ReturnType<typeof setTimeout> | null = null;
      let destroyed = false;
      const scheduleRefreshRecheck = (): void => {
        if (refreshTimer) clearTimeout(refreshTimer);
        refreshTimer = setTimeout(() => {
          refreshTimer = null;
          if (!destroyed) void requestDivergenceCheck(editorView);
        }, REFRESH_RECHECK_MS);
      };
      // In-doc copies resolve from the live doc (sync, cheap), so their badge can
      // update shortly after an edit — but NOT per keystroke. Debounce it: fold
      // the in-doc divergence into the set once typing pauses.
      const scheduleInDocRecheck = (): void => {
        if (inDocTimer) clearTimeout(inDocTimer);
        inDocTimer = setTimeout(() => {
          inDocTimer = null;
          if (destroyed) return;
          const { all, diverged: inDoc } = inDocDivergence(editorView.state.doc);
          const current =
            transclusionDivergenceKey.getState(editorView.state)?.diverged ?? new Set<string>();
          const merged = new Set([...current].filter((id) => !all.has(id)));
          for (const id of inDoc) merged.add(id);
          if (!setsEqual(merged, current)) {
            editorView.dispatch(editorView.state.tr.setMeta(transclusionDivergenceKey, merged));
          }
        }, IN_DOC_RECHECK_MS);
      };
      const armIdle = (): void => {
        if (idle) clearTimeout(idle);
        idle = setTimeout(() => {
          idle = null;
          if (destroyed) return;
          void requestDivergenceCheck(editorView).finally(() => {
            if (!destroyed) armIdle(); // keep the ~10-min quiet cadence going
          });
        }, DIVERGENCE_IDLE_MS);
      };
      // Check on open (after the view settles), then start the idle cadence.
      const initial = setTimeout(() => {
        if (!destroyed) void requestDivergenceCheck(editorView);
      }, 0);
      armIdle();
      return {
        update(v, prevState) {
          // Any real edit means the user is active — push the quiet-moment
          // recheck out so it lands once they've paused, and debounce the cheap
          // in-doc divergence recheck.
          if (!v.state.doc.eq(prevState.doc)) {
            armIdle();
            scheduleInDocRecheck();
          }
          // A refresh just re-pulled a zone — recheck promptly so a now-in-sync
          // zone's badge clears without waiting for the idle cadence.
          const seq = transclusionDivergenceKey.getState(v.state)?.refreshSeq ?? 0;
          const prevSeq = transclusionDivergenceKey.getState(prevState)?.refreshSeq ?? 0;
          if (seq !== prevSeq) scheduleRefreshRecheck();
        },
        destroy() {
          destroyed = true;
          clearTimeout(initial);
          if (idle) clearTimeout(idle);
          if (refreshTimer) clearTimeout(refreshTimer);
          if (inDocTimer) clearTimeout(inDocTimer);
        },
      };
    },
  });
}
