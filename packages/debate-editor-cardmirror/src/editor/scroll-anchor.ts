/**
 * Viewport scroll-anchoring across a layout change.
 *
 * Read mode (content collapses) and zoom (content scales) both move the
 * document under a fixed `scrollTop`, so whatever sat at the top of the
 * viewport slides away — the drift the maintainer observed. This module
 * captures the document position at the viewport top BEFORE the change
 * and, after layout settles, nudges `scrollTop` so that same position
 * returns to where it was. Zero drift.
 *
 * The two operations need different anchor targets:
 *   - Read mode HIDES content, so the line at the viewport top may vanish.
 *     With `{ readMode: true }` it anchors to the FIRST text read mode keeps
 *     visible scanning DOWN from the viewport top (a highlighted run / cite
 *     / heading) and pins that to the viewport TOP — the hidden content
 *     above it collapses to nothing, so the first survivor rises to the top.
 *     If the whole viewport collapses, the nearest kept content in either
 *     direction is used instead.
 *   - Zoom SCALES content and hides nothing, so it anchors to the exact
 *     top position. A distant block would drift proportionally under
 *     scaling (its gap to the viewport top scales too), so no snap.
 *
 * The correction is measured with `coordsAtPos`, which always queries the
 * live DOM — so a decoration rebuild that recreates elements (read mode)
 * is transparent, and a CSS `zoom` change is reflected exactly.
 */
import type { EditorView } from 'prosemirror-view';
import { nearestScroller } from './precise-scroll.js';
import { firstReadKeptPos, nearestReadKeptPos } from './read-mode-plugin.js';

export interface ViewportAnchor {
  view: EditorView;
  scroller: HTMLElement | null;
  pos: number;
  /** Viewport-relative y of `pos` captured before the layout change. */
  topBefore: number;
}

/**
 * Pure: the `scrollTop` that returns an anchored position from its
 * post-change viewport y back to its pre-change y. Raising `scrollTop`
 * moves content up, lowering a position's viewport y — so to send the
 * position from `topAfter` back to `topBefore` we add their difference.
 * Exported for unit testing (jsdom has no layout engine, so the DOM path
 * can't be exercised directly).
 */
export function anchoredScrollTop(
  scrollTop: number,
  topBefore: number,
  topAfter: number,
): number {
  return scrollTop + (topAfter - topBefore);
}

/** Capture the doc position at the top of the viewport, plus its current
 *  screen y. Returns null when there's nothing to anchor to (no layout —
 *  e.g. tests — or an empty hit-test), in which case callers skip the
 *  restore and behave exactly as before. */
export function captureViewportAnchor(
  view: EditorView,
  opts: { readMode?: boolean } = {},
): ViewportAnchor | null {
  const dom = view.dom as HTMLElement;
  if (!dom.isConnected) return null;
  const scroller = nearestScroller(dom);
  const scrollerRect = scroller
    ? scroller.getBoundingClientRect()
    : { top: 0, bottom: window.innerHeight };
  const domRect = dom.getBoundingClientRect();
  const left = domRect.left + Math.min(40, Math.max(2, domRect.width / 2));
  const hitAt = (y: number): { pos: number } | null => {
    try {
      return view.posAtCoords({ left, top: y });
    } catch {
      return null;
    }
  };
  const topHit = hitAt(scrollerRect.top + 1);
  if (!topHit) return null;

  if (opts.readMode) {
    // Anchor to the FIRST content that survives read mode, scanning down
    // from the viewport top; if the whole viewport collapses, the nearest
    // kept content in either direction. Pin it TO the viewport top — the
    // hidden content above it collapses away, so it rises to the top.
    const doc = view.state.doc;
    const botHit = hitAt(scrollerRect.bottom - 1);
    const to = botHit ? Math.max(topHit.pos, botHit.pos) : doc.content.size;
    const pos =
      firstReadKeptPos(doc, topHit.pos, to) ??
      nearestReadKeptPos(doc, topHit.pos) ??
      topHit.pos;
    return { view, scroller, pos, topBefore: scrollerRect.top };
  }

  // Zoom: nothing hides, so anchor to the exact viewport-top position and
  // preserve its precise screen Y (scaling is measured via coordsAtPos).
  let topBefore: number;
  try {
    topBefore = view.coordsAtPos(topHit.pos).top;
  } catch {
    return null;
  }
  return { view, scroller, pos: topHit.pos, topBefore };
}

/** Max refine passes. cv:auto cards can materialize a frame or two after
 *  the layout change, shifting the anchor; re-correct until stable. */
const MAX_ANCHOR_REFINE = 6;
const ANCHOR_TOLERANCE_PX = 1;

/** Monotonic claim ticket: each restore takes the next value and every
 *  refine step aborts once a newer restore exists — "latest wins", the
 *  same philosophy as precise-scroll's `scrollGeneration`. Without it,
 *  two refine loops (rapid zoom steps, or a zoom racing a read-mode
 *  toggle) run concurrently and alternate `scrollTop` writes toward
 *  DIFFERENT targets — the visible viewport fight under fast zooming. */
let restoreGeneration = 0;

/** Restore a captured anchor after the layout change: nudge the
 *  scroller so `pos` returns to `topBefore`. Runs across
 *  `requestAnimationFrame`s so it measures post-relayout, and refines a
 *  few times against cv:auto materialization (same philosophy as
 *  `preciseScrollIntoView`). Only the LATEST restore's loop may write —
 *  starting a new restore silently retires any in-flight one. No-op
 *  when the anchor had no scroller. */
export function restoreViewportAnchor(anchor: ViewportAnchor): void {
  const { view, scroller, pos, topBefore } = anchor;
  if (!scroller) return;
  const generation = ++restoreGeneration;
  let iterations = 0;
  const step = (): void => {
    if (generation !== restoreGeneration) return; // superseded — latest wins
    if (!(view.dom as HTMLElement).isConnected) return;
    let topAfter: number;
    try {
      topAfter = view.coordsAtPos(pos).top;
    } catch {
      return;
    }
    const delta = topAfter - topBefore;
    if (Math.abs(delta) < ANCHOR_TOLERANCE_PX) return;
    scroller.scrollTop = anchoredScrollTop(scroller.scrollTop, topBefore, topAfter);
    if (++iterations >= MAX_ANCHOR_REFINE) return;
    requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}
