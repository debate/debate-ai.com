/**
 * Frequency-ranked highlight / shading override.
 *
 * The user picks 1-3 override colors per mark family (highlight,
 * shading) in Settings → Accessibility. When there are multiple
 * slots, this plugin ranks the source colors in the doc by usage
 * (character count) and writes a dynamic stylesheet:
 *
 *   - The MOST-common source color → slot 0
 *   - The SECOND-most-common → slot 1 (if slots.length ≥ 2)
 *   - Everything else → the LAST slot (catch-all), via the
 *     static rule in style.css that references
 *     `--pmd-c-override-{highlight,shading}` (set by
 *     applyHighlightShadingOverride to the last slot's color).
 *
 * Performance design:
 *
 *   1. **Inactive when not needed.** If the feature is off, or
 *      slots.length ≤ 1, or all slots are equal, the plugin
 *      doesn't track counts and the dynamic stylesheet stays
 *      empty. The static catch-all rule handles the single-color
 *      case end-to-end.
 *
 *   2. **Initial scan on activation.** The first time activation
 *      transitions to true, walk the whole doc once to populate
 *      counts.
 *
 *   3. **Incremental updates.** Once active, every doc-changing
 *      transaction updates counts by counting marks in the
 *      transaction's affected range — before-state (subtract) and
 *      after-state (add). Avoids re-scanning the whole doc.
 *
 *   4. **Debounced stylesheet recompute.** The dynamic stylesheet
 *      rebuilds 250ms after the last activity. Rapid edits
 *      collapse to one rebuild.
 *
 *   5. **Doc-change / mark-step filter.** Transactions that
 *      neither change the doc NOR touch a highlight/shading mark
 *      are no-ops. Selection moves don't trigger counting.
 *
 * The plugin maintains per-view state (PM plugin state). Each
 * EditorView in multi-doc mode gets its own counts because each
 * is editing a different doc.
 */

import { Plugin, PluginKey } from 'prosemirror-state';
import type { EditorState, Transaction } from 'prosemirror-state';
import { AddMarkStep, RemoveMarkStep } from 'prosemirror-transform';
import type { Node as PMNode } from 'prosemirror-model';
import { settings } from './settings.js';

interface FreqState {
  /** color → character count (lengths of inline runs carrying the mark). */
  highlight: Map<string, number>;
  shading: Map<string, number>;
  /** True once the initial full-doc scan has populated `highlight` /
   *  `shading`. We skip the scan until the plugin transitions from
   *  inactive to active so the user pays no perf cost when the
   *  feature is off. */
  initialized: boolean;
  /** Monotonic counter — bumped on every state change that would
   *  affect the stylesheet. The view layer compares against its
   *  last-rendered generation to decide whether to schedule a
   *  recompute. */
  generation: number;
}

const META_FORCE_RESCAN = 'pmd-freq:force-rescan';

export const highlightFreqKey = new PluginKey<FreqState>('highlight-frequency');

function emptyCounts(): FreqState {
  return {
    highlight: new Map(),
    shading: new Map(),
    initialized: false,
    generation: 0,
  };
}

/** Plugin needs to track counts iff at least one of (highlight,
 *  shading) has a multi-slot override active. When everything is
 *  single-slot (or the feature is off), the static catch-all
 *  rule handles rendering and we can skip all work. */
function isActive(): boolean {
  const s = settings.get('overrideHighlightColor');
  const hSlots = settings.get('overrideHighlightSlots');
  const t = settings.get('overrideShadingColor');
  const sSlots = settings.get('overrideShadingSlots');
  const hMulti = s && distinctSlotCount(hSlots) > 1;
  const sMulti = t && distinctSlotCount(sSlots) > 1;
  return hMulti || sMulti;
}

/** A slot list with 3 slots all set to the same color is the same
 *  as a single slot — no frequency ranking changes the output, so
 *  count this as 1 distinct slot. */
function distinctSlotCount(slots: string[]): number {
  const set = new Set<string>();
  for (const s of slots) set.add(s.toLowerCase().trim());
  return set.size;
}

/** Walk every inline node in [from, to] of `doc` and accumulate
 *  the character counts of each highlight / shading color. Used
 *  by both the initial full-doc scan and the per-transaction
 *  incremental update. */
function countMarksInRange(
  doc: PMNode,
  from: number,
  to: number,
  out: { highlight: Map<string, number>; shading: Map<string, number> } = {
    highlight: new Map(),
    shading: new Map(),
  },
): { highlight: Map<string, number>; shading: Map<string, number> } {
  if (from >= to) return out;
  doc.nodesBetween(from, to, (node, pos) => {
    if (!node.isInline) return true;
    const start = Math.max(pos, from);
    const end = Math.min(pos + node.nodeSize, to);
    const len = end - start;
    if (len <= 0) return false;
    for (const m of node.marks) {
      if (m.type.name === 'highlight') {
        const c = String(m.attrs['color'] ?? '');
        out.highlight.set(c, (out.highlight.get(c) ?? 0) + len);
      } else if (m.type.name === 'shading') {
        const c = String(m.attrs['color'] ?? '');
        out.shading.set(c, (out.shading.get(c) ?? 0) + len);
      }
    }
    return false;
  });
  return out;
}

/** Compute the bounding range affected by a transaction, in both
 *  the OLD doc (positions in `oldState.doc`) and the NEW doc
 *  (positions in the post-transaction doc). Returns `null` when
 *  nothing changed (selection-only transactions). */
function affectedRange(
  tr: Transaction,
): { oldFrom: number; oldTo: number; newFrom: number; newTo: number } | null {
  // tr.mapping is the composition of every step's position map.
  // Each map's forEach gives (oldStart, oldEnd, newStart, newEnd)
  // for the affected slice, expressed at each map's CURRENT
  // before/after positions. Compose into the overall tr's
  // before/after positions by remapping through the slices of
  // tr.mapping that come before/after each individual step.
  let oldFrom = Infinity;
  let oldTo = -Infinity;
  let newFrom = Infinity;
  let newTo = -Infinity;
  let hit = false;
  for (let i = 0; i < tr.mapping.maps.length; i++) {
    const map = tr.mapping.maps[i]!;
    map.forEach((stepOldStart, stepOldEnd, stepNewStart, stepNewEnd) => {
      hit = true;
      // Map step-time positions through the chain of earlier maps
      // INVERSELY to get the original-old positions, and through
      // later maps to get the final-new positions.
      const before = tr.mapping.slice(0, i);
      const after = tr.mapping.slice(i + 1);
      const oA = before.invert().map(stepOldStart, -1);
      const oB = before.invert().map(stepOldEnd, 1);
      const nA = after.map(stepNewStart, -1);
      const nB = after.map(stepNewEnd, 1);
      oldFrom = Math.min(oldFrom, oA);
      oldTo = Math.max(oldTo, oB);
      newFrom = Math.min(newFrom, nA);
      newTo = Math.max(newTo, nB);
    });
  }
  if (!hit) return null;
  return { oldFrom, oldTo, newFrom, newTo };
}

/** Apply (oldRangeCounts, newRangeCounts) delta to the running
 *  count map. Subtract old, add new, drop zero entries. */
function applyDelta(
  cur: Map<string, number>,
  oldR: Map<string, number>,
  newR: Map<string, number>,
): Map<string, number> {
  const out = new Map(cur);
  for (const [color, n] of oldR) {
    out.set(color, (out.get(color) ?? 0) - n);
  }
  for (const [color, n] of newR) {
    out.set(color, (out.get(color) ?? 0) + n);
  }
  // Drop zero / negative — should never go negative in practice
  // but clamp defensively so a small bug doesn't permanently
  // strand a phantom entry.
  for (const [color, n] of out) {
    if (n <= 0) out.delete(color);
  }
  return out;
}

/** True if `tr` touches a highlight or shading mark, even when the
 *  doc otherwise looks unchanged (a tr applying a highlight to a
 *  selection is `tr.docChanged === true`, so this is mostly a
 *  belt-and-suspenders for transactions that emit mark steps
 *  without other content changes). */
function touchesRelevantMarks(tr: Transaction): boolean {
  for (const step of tr.steps) {
    if (step instanceof AddMarkStep || step instanceof RemoveMarkStep) {
      const name = step.mark.type.name;
      if (name === 'highlight' || name === 'shading') return true;
    }
  }
  return false;
}

export const highlightFrequencyPlugin = new Plugin<FreqState>({
  key: highlightFreqKey,
  state: {
    init: () => emptyCounts(),
    apply(tr, prev, oldState, newState) {
      // Inactive: zero work. Keep an empty state.
      if (!isActive()) {
        if (prev.initialized || prev.generation !== 0) {
          return emptyCounts();
        }
        return prev;
      }
      // If not yet initialized, the view layer below triggers a
      // full scan via setMeta(META_FORCE_RESCAN) once it notices
      // the gap; pass through here.
      const force = tr.getMeta(META_FORCE_RESCAN) as
        | { highlight: Map<string, number>; shading: Map<string, number> }
        | undefined;
      if (force) {
        return {
          highlight: force.highlight,
          shading: force.shading,
          initialized: true,
          generation: prev.generation + 1,
        };
      }
      if (!prev.initialized) return prev;
      // Doc-change / mark-step filter.
      if (!tr.docChanged && !touchesRelevantMarks(tr)) return prev;
      const range = affectedRange(tr);
      if (!range) return prev;
      // Incremental update — subtract old-range counts, add
      // new-range counts. Cost is O(affected-range length), not
      // O(doc).
      const oldR = countMarksInRange(
        oldState.doc,
        Math.max(0, range.oldFrom),
        Math.min(oldState.doc.content.size, range.oldTo),
      );
      const newR = countMarksInRange(
        newState.doc,
        Math.max(0, range.newFrom),
        Math.min(newState.doc.content.size, range.newTo),
      );
      return {
        highlight: applyDelta(prev.highlight, oldR.highlight, newR.highlight),
        shading: applyDelta(prev.shading, oldR.shading, newR.shading),
        initialized: true,
        generation: prev.generation + 1,
      };
    },
  },
  view(view) {
    let timer: ReturnType<typeof setTimeout> | null = null;
    let lastRenderedGeneration = -1;
    // Set in destroy() so the deferred mount scan below skips a view that
    // was torn down before its microtask ran (e.g. a fast re-mount).
    let disposed = false;

    function applyStylesheet(): void {
      timer = null;
      const cur = highlightFreqKey.getState(view.state);
      if (!cur) return;
      writeFrequencyStylesheet(
        cur.highlight,
        cur.shading,
        settings.get('overrideHighlightSlots'),
        settings.get('overrideShadingSlots'),
        settings.get('overrideHighlightColor'),
        settings.get('overrideShadingColor'),
      );
      lastRenderedGeneration = cur.generation;
    }

    function scheduleApply(): void {
      if (timer !== null) clearTimeout(timer);
      timer = setTimeout(applyStylesheet, 250);
    }

    let lastActivation = false;

    /** Called from `view` mount + every settings change. Walks
     *  the activation-state transitions:
     *    - inactive → active : fresh full-doc scan + initialize.
     *    - active → inactive : clear counts so a future
     *      re-activation does a fresh scan (the doc may have
     *      changed during the inactive period).
     *    - active → active : no-op; existing counts stay valid
     *      because transactions kept them current incrementally. */
    function syncActivation(): void {
      const cur = highlightFreqKey.getState(view.state);
      if (!cur) return;
      const active = isActive();
      if (active && !lastActivation) {
        // Transitioned to active — populate counts.
        const counts = countMarksInRange(
          view.state.doc,
          0,
          view.state.doc.content.size,
        );
        view.dispatch(
          view.state.tr.setMeta(META_FORCE_RESCAN, counts) as Transaction,
        );
      } else if (active && !cur.initialized) {
        // Plugin state was reset (e.g., editor reconfigured) while
        // active. Re-populate.
        const counts = countMarksInRange(
          view.state.doc,
          0,
          view.state.doc.content.size,
        );
        view.dispatch(
          view.state.tr.setMeta(META_FORCE_RESCAN, counts) as Transaction,
        );
      } else if (!active && cur.initialized) {
        // Transitioned to inactive — clear state. Next activation
        // will scan from scratch.
        view.dispatch(
          view.state.tr.setMeta(META_FORCE_RESCAN, {
            highlight: new Map(),
            shading: new Map(),
          }) as Transaction,
        );
      }
      lastActivation = active;
    }

    // Initial activation check at mount: if the feature is on already
    // (persisted state), kick off the scan. Deferred to a microtask so it
    // dispatches AFTER `new EditorView(...)` returns and the host (single-
    // doc `mountView` / multi-pane `buildDocRecord`) has bound its `view`.
    // Dispatching synchronously here fires mid-construction, where the
    // editor's dispatchTransaction can't yet route the transaction to this
    // view — on a re-mount that surfaced as "Applying a mismatched
    // transaction"; on first mount it was silently dropped, so the frequency
    // colors never populated until the first edit. The microtask fixes both.
    queueMicrotask(() => {
      if (!disposed) syncActivation();
    });
    scheduleApply();

    // Settings subscription — handle slot changes (no rescan
    // needed; counts are doc-derived) and feature-toggle changes
    // (which DO need scan/clear, handled in syncActivation).
    const unsubSettings = settings.subscribe(() => {
      syncActivation();
      // Slot-value changes are immediate (no debounce) — UI
      // responsiveness when the user tweaks a color picker.
      applyStylesheet();
    });

    return {
      update(view, prevState) {
        const cur = highlightFreqKey.getState(view.state);
        if (!cur) return;
        if (cur.generation !== lastRenderedGeneration) {
          scheduleApply();
        }
        // Doc was replaced (different doc loaded into the same
        // view via view.updateState) — plugin state survives the
        // swap and now references stale positions. Force a rescan
        // when active.
        if (
          prevState &&
          prevState.doc !== view.state.doc &&
          !view.state.doc.eq(prevState.doc) &&
          isActive()
        ) {
          const counts = countMarksInRange(
            view.state.doc,
            0,
            view.state.doc.content.size,
          );
          view.dispatch(
            view.state.tr.setMeta(META_FORCE_RESCAN, counts) as Transaction,
          );
        }
      },
      destroy() {
        disposed = true;
        if (timer !== null) clearTimeout(timer);
        unsubSettings();
        // Tear down the stylesheet so a destroyed view doesn't
        // leave behind stale per-color rules (multi-pane reuses
        // the singleton stylesheet across views).
        writeFrequencyStylesheet(
          new Map(),
          new Map(),
          settings.get('overrideHighlightSlots'),
          settings.get('overrideShadingSlots'),
          false,
          false,
        );
      },
    };
  },
});

/** Singleton style element holding the per-color override rules.
 *  Created on first use; reused across recomputes. */
function getOrCreateStylesheet(): HTMLStyleElement {
  let el = document.getElementById('pmd-freq-overrides') as HTMLStyleElement | null;
  if (el) return el;
  el = document.createElement('style');
  el.id = 'pmd-freq-overrides';
  document.head.appendChild(el);
  return el;
}

/** Rebuild the dynamic stylesheet from the current counts +
 *  slot config. Each invocation rewrites the entire textContent
 *  — cheap (< 1KB string) and avoids the bookkeeping of patching
 *  individual rules. */
function writeFrequencyStylesheet(
  highlightCounts: Map<string, number>,
  shadingCounts: Map<string, number>,
  highlightSlots: string[],
  shadingSlots: string[],
  highlightOn: boolean,
  shadingOn: boolean,
): void {
  const sheet = getOrCreateStylesheet();
  const lines: string[] = [];
  if (highlightOn) {
    lines.push(...buildRules('highlight', highlightCounts, highlightSlots));
  }
  if (shadingOn) {
    lines.push(...buildRules('shading', shadingCounts, shadingSlots));
  }
  sheet.textContent = lines.join('\n');
}

function buildRules(
  kind: 'highlight' | 'shading',
  counts: Map<string, number>,
  slots: string[],
): string[] {
  if (slots.length <= 1) return []; // single-slot handled by static rule
  // Sort colors by count, descending. Tie-break alphabetically so
  // ordering is deterministic.
  const ranked = [...counts.entries()]
    .filter(([, n]) => n > 0)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([color]) => color);
  // Top (slots.length - 1) colors get explicit per-color rules.
  // The last slot is the catch-all handled by style.css's static
  // rule (`--pmd-c-override-{kind}` is the LAST slot color).
  const out: string[] = [];
  const cap = Math.min(ranked.length, slots.length - 1);
  for (let i = 0; i < cap; i++) {
    const color = ranked[i]!;
    const value = slots[i]!;
    if (kind === 'highlight') {
      // Highlight uses data-highlight="<name>" (OOXML name like "yellow").
      // Quoting protects against unexpected characters.
      out.push(
        `body.pmd-override-highlight .pmd-highlight[data-highlight=${JSON.stringify(color)}] { background: ${value} !important; }`,
      );
    } else {
      // Shading uses data-shading="<rrggbb>" (no leading #).
      out.push(
        `body.pmd-override-shading [data-shading=${JSON.stringify(color)}] { background-color: ${value} !important; }`,
      );
    }
  }
  return out;
}
