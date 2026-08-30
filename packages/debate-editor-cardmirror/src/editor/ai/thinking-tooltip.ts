/**
 * Floating "Thinking…" pill shown while an AI request is in flight.
 * Shared by every AI feature that doesn't have its own side-panel
 * placeholder — cite-creator, repair, the card cutter, generate-alt-
 * text, generate-table-from-image, etc.
 *
 * Positioning: the pill hugs the LEFT edge of the editor, vertically
 * just above the target selection. Because a long card can scroll the
 * selection out of view (and the selection itself is cleared while the
 * AI works), the pill clamps into the editor's visible area: if the
 * target is scrolled off the top it pins to the editor's top-left
 * corner; if it's off the bottom it pins to the bottom-left, just
 * above the dropzone. It re-positions on scroll/resize so it stays put
 * relative to the editor as the doc moves underneath it.
 *
 * When Clod mode is on, the pill cycles through the user's persona
 * activities; otherwise it reads "Thinking…".
 */

import type { EditorView } from 'prosemirror-view';
import { settings } from '../settings.js';
import { rangeRect } from './ai-working-box.js';
import {
  activitiesForNow,
  pickRandomActivity,
  personalizeActivity,
  inFlightLine,
} from './clod.js';
import { getAiPersona } from '../comments-ui.js';
import { makeActivityStage, cycleActivityText } from './activity-cycler.js';

/** Interval between activity-text cycles. Matches `ACTIVITY_TICK_MS`
 *  in `comments-ui.ts` (which carries the rationale) so activity text
 *  cycles at the same cadence everywhere. */
const ACTIVITY_TICK_MS = 4000;

/** Gap (px) between the pill and the editor edges / the selection. */
const EDGE = 8;
const SEL_GAP = 6;
/** Vertical gap (px) between two pills queued at the same editor edge. */
const PILL_STACK_GAP = 6;

export interface TooltipRange {
  from: number;
  to: number;
}

/**
 * Pack a set of pills into a non-overlapping vertical column.
 *
 * Each item has a height and a DESIRED top (just above its target, or an
 * editor edge when its target scrolled off). Returns the resolved tops, in
 * the SAME order as the input. Two passes: top→bottom in desired order pushes
 * each below the previous (a cluster near the top edge queues downward), then
 * bottom→top pushes any overflow back up so the lowest pill ends at the floor
 * (a cluster near the bottom edge queues upward), never above the top edge.
 *
 * Pure (no DOM) so the spacing logic is unit-testable.
 */
export function packColumn(
  items: ReadonlyArray<{ h: number; desired: number }>,
  bandTop: number,
  dropFloor: number,
  gap: number,
): number[] {
  // Indices ordered by desired top; the sort is stable, so pills sharing a
  // desired position (e.g. all pinned to the same edge) keep their order.
  const order = items.map((_, i) => i).sort((a, b) => items[a]!.desired - items[b]!.desired);
  const tops = new Array<number>(items.length);

  let cursor = bandTop;
  for (const i of order) {
    tops[i] = Math.max(items[i]!.desired, cursor);
    cursor = tops[i]! + items[i]!.h + gap;
  }

  let limit = dropFloor;
  for (let k = order.length - 1; k >= 0; k--) {
    const i = order[k]!;
    tops[i] = Math.max(bandTop, Math.min(tops[i]!, limit - items[i]!.h));
    limit = tops[i]! - gap;
  }
  return tops;
}

/** Find the on-screen editor box (single-doc `#editor` or a multi-doc
 *  pane) so the pill can anchor to the editor, not the whole page. */
function editorBox(view: EditorView): HTMLElement {
  return (
    (view.dom.closest('#editor, .pmd-pane-editor') as HTMLElement | null) ??
    (view.dom.parentElement as HTMLElement) ??
    view.dom
  );
}

/** Bottom edge (viewport y) of the fixed top chrome — the ribbon plus
 *  the speech banner when shown — so the pill never tucks behind it. */
function topChromeBottom(): number {
  let bottom = 0;
  const ribbon = document.getElementById('ribbon');
  if (ribbon) bottom = Math.max(bottom, ribbon.getBoundingClientRect().bottom);
  if (document.body.classList.contains('pmd-speech-banner-visible')) {
    const banner = document.getElementById('speech-doc-banner');
    if (banner) bottom = Math.max(bottom, banner.getBoundingClientRect().bottom);
  }
  return bottom;
}

/** A single visible pill anchored to the editor + a doc range. `show()`
 *  mounts and starts tracking; `setRange()` re-anchors (e.g. between
 *  repair passes); `hide()` cleans up. */
export class ThinkingTooltip {
  /** Every mounted pill, in creation order — the queue order when several
   *  pin to the same editor edge. A new pill takes the back of the queue;
   *  when one finishes the rest advance toward the edge. */
  private static readonly active = new Set<ThinkingTooltip>();

  private el: HTMLDivElement | null = null;
  private ticker: number | null = null;
  private view: EditorView | null = null;
  private range: TooltipRange = { from: 0, to: 0 };
  /** When set, the pill names the current stage instead of cycling
   *  generic activities (used by the card cutter). A gerund phrase like
   *  "pruning for redundancy". */
  private stageText: string | null = null;
  private readonly onScroll = (): void => this.reposition();

  /** Name the current pipeline stage (or null to return to the generic
   *  "Thinking…" / Clod activity). Updates the pill immediately. */
  setStage(stage: string | null): void {
    this.stageText = stage;
    if (!this.el) return;
    const s = this.el.querySelector<HTMLElement>('.pmd-activity-stage');
    if (s) cycleActivityText(s, this.currentText());
    this.reposition();
  }

  show(view: EditorView, range: TooltipRange): void {
    if (this.el) {
      this.setRange(range);
      return;
    }
    this.view = view;
    this.range = range;
    const el = document.createElement('div');
    el.className = 'pmd-ai-cite-tooltip';
    el.style.position = 'fixed';
    el.appendChild(makeActivityStage(this.currentText()));
    document.body.appendChild(el);
    this.el = el;
    ThinkingTooltip.active.add(this);
    ThinkingTooltip.relayout();

    // Capture-phase scroll catches the editor's inner scroller too
    // (scroll events don't bubble); resize handles window changes.
    window.addEventListener('scroll', this.onScroll, true);
    window.addEventListener('resize', this.onScroll);

    this.ticker = window.setInterval(() => {
      if (!this.el) return;
      const stage = this.el.querySelector<HTMLElement>('.pmd-activity-stage');
      if (stage) cycleActivityText(stage, this.currentText());
      this.reposition(); // width/height can change as text cycles
    }, ACTIVITY_TICK_MS);
  }

  /** Re-anchor to a new range (positions may have been re-mapped). */
  setRange(range: TooltipRange): void {
    this.range = range;
    this.reposition();
  }

  hide(): void {
    if (this.ticker !== null) {
      window.clearInterval(this.ticker);
      this.ticker = null;
    }
    window.removeEventListener('scroll', this.onScroll, true);
    window.removeEventListener('resize', this.onScroll);
    if (this.el) {
      this.el.remove();
      this.el = null;
    }
    this.view = null;
    // Drop out of the queue and let the remaining pills advance.
    ThinkingTooltip.active.delete(this);
    ThinkingTooltip.relayout();
  }

  /** Re-anchoring is a shared concern: a pill pinned to an editor edge has
   *  to know about the other pinned pills so they queue instead of stacking.
   *  So any one pill's reposition triggers a layout of all of them. */
  private reposition(): void {
    ThinkingTooltip.relayout();
  }

  /** The target's viewport top/bottom (may be off-screen), or null if it
   *  can't be resolved. Uses the range's DOM rect so an image (an inline
   *  atom) anchors to its real box — `coordsAtPos` returns only a
   *  degenerate caret rect for an atom. */
  private targetSpan(): { top: number; bottom: number } | null {
    if (!this.view) return null;
    const rect = rangeRect(this.view, this.range);
    if (rect) return { top: rect.top, bottom: rect.bottom };
    try {
      const a = this.view.coordsAtPos(this.range.from);
      return { top: a.top, bottom: a.bottom };
    } catch {
      return null;
    }
  }

  /** Lay out every mounted pill as a single non-overlapping column per
   *  editor. Each pill's DESIRED top is just above its target (or the top
   *  edge when the target scrolled off the top, the bottom edge when it
   *  scrolled off the bottom). A two-pass sweep then spaces them so they
   *  never overlap — pills clustered near an edge queue along it rather than
   *  piling on the same spot, including the transition where targets are
   *  near, but not yet past, an edge. Grouped by editor so multi-pane panes
   *  stay independent. */
  private static relayout(): void {
    const groups = new Map<HTMLElement, ThinkingTooltip[]>();
    for (const p of ThinkingTooltip.active) {
      if (!p.el || !p.view) continue;
      const box = editorBox(p.view);
      const arr = groups.get(box);
      if (arr) arr.push(p);
      else groups.set(box, [p]);
    }

    for (const [box, pills] of groups) {
      const rect = box.getBoundingClientRect();
      // Band top/bottom come from the SCROLL VIEWPORT (the visible editor area)
      // — `#app` single-doc, `.pmd-pane-body` per pane — NOT the scrolled
      // content box (`#editor` / `.pmd-pane-editor`), whose top slides negative
      // as the doc scrolls. Using the content top made an off-top / near-top
      // pill fall back to `topChromeBottom()` (the ribbon), which in multi-pane
      // sits ABOVE the pane's doc-name chip — so pills piled onto that chip
      // instead of the pane's content top. The left edge still hugs the content.
      const viewport = (box.closest('#app, .pmd-pane-body') as HTMLElement | null) ?? box;
      const vrect = viewport.getBoundingClientRect();
      const bandTop = Math.max(vrect.top, topChromeBottom(), 0) + EDGE;
      const bandBottom = Math.min(vrect.bottom, window.innerHeight) - EDGE;
      const dz = document.querySelector('.pmd-dropzone-root');
      const dropFloor = dz
        ? Math.min(dz.getBoundingClientRect().top - SEL_GAP, bandBottom)
        : bandBottom;
      const left = rect.left + EDGE;

      const items = pills.map((p) => {
        const el = p.el!;
        el.style.left = `${left}px`;
        const h = el.offsetHeight || 28;
        const span = p.targetSpan();
        let desired: number;
        if (!span || span.bottom < bandTop) {
          desired = bandTop; // off the top (or unresolved) → top edge
        } else if (span.top > bandBottom) {
          desired = dropFloor - h; // off the bottom → bottom edge
        } else {
          desired = Math.max(bandTop, Math.min(span.top - h - SEL_GAP, dropFloor - h));
        }
        return { el, h, desired };
      });

      const tops = packColumn(items, bandTop, dropFloor, PILL_STACK_GAP);
      items.forEach((it, i) => {
        it.el.style.top = `${tops[i]}px`;
      });
    }
  }

  private currentText(): string {
    // Stage narration (card cutter, cite reformat) overrides the
    // generic activity — composed by the shared persona-aware line so
    // a configured persona name shows here too, not a hardcoded Clod.
    if (this.stageText) {
      return inFlightLine(this.stageText, settings.get('clodEnabled'), getAiPersona().name);
    }
    if (!settings.get('clodEnabled')) return 'Thinking…';
    const pool = activitiesForNow({
      customByTime: settings.get('clodActivitiesByTime'),
      ranges: settings.get('clodTimePeriods'),
    });
    return personalizeActivity(pickRandomActivity(pool), getAiPersona());
  }
}
