/**
 * `Element.scrollIntoView` with cv:auto-aware refinement.
 *
 * Cards (`.pmd-card`, `.pmd-pocket`, `.pmd-hat`, `.pmd-block`,
 * `.pmd-analytic-unit`) carry `content-visibility: auto` with a
 * `contain-intrinsic-size` placeholder. Off-screen subtrees skip
 * layout and the browser substitutes the placeholder height for
 * any scroll-position math. A plain `scrollIntoView` on a deep
 * heading therefore lands imprecisely the first time.
 *
 * Algorithm — optimistic + refine:
 *   1. Call `scrollIntoView({ block })`. With cv:auto's placeholder
 *      heights, the browser may land the target imprecisely — but
 *      the scroll causes Chromium to materialize the cards around
 *      the new viewport position, including the target.
 *   2. Wait one frame. Read `target.getBoundingClientRect().top`.
 *      The target is now materialized, so this returns its real
 *      on-screen y-position.
 *   3. If it's within tolerance of the requested alignment, done.
 *      If not, re-issue `scrollIntoView` — this time using the
 *      target's real position (it's materialized now) and any
 *      newly-materialized neighbors' real heights. Each iteration
 *      brings more layout truth into the system.
 *   4. Cap at MAX_REFINE_ITERATIONS to defend against pathological
 *      cases where late-arriving layout work prevents convergence
 *      (image / font load mid-iteration, etc.). Worst case: the
 *      user sees the target within ~one viewport of the requested
 *      alignment, which is much better than a multi-second pause.
 *
 * Why not force-materialize first: flipping every card to
 * cv:visible and reading `editor.offsetHeight` before scrolling
 * would give exact layout, but that style-cascade + full-doc
 * layout pass costs ~2 s on a 2000-card Verbatim — paid on every
 * nav-pane click, even when the target is already on-screen. The
 * optimistic path trades precision-on-first-try for never paying
 * full-doc layout: clicks on visible targets cost a few ms, and
 * clicks into fresh regions pay only what cv:auto charges for the
 * destination cards anyway. cv:auto is never flipped off, so
 * per-keystroke layout stays scoped to the cursor's containing
 * card.
 */

import type { EditorView } from 'prosemirror-view';

/** Find the nearest scrolling-overflow ancestor of `el`. Returns the
 *  element if one exists, or `null` to fall back to the viewport.
 *  The convergence check below anchors `desiredTop` to the scroller's
 *  visible region — the window is not the scroller here: single-doc
 *  scrolls in a bounded `#app` (`style.css`,
 *  `body:not(.pmd-multi-doc) #app`) and multi-pane in
 *  `.pmd-pane-body`. */
export function nearestScroller(el: HTMLElement): HTMLElement | null {
  let cur: HTMLElement | null = el.parentElement;
  while (cur) {
    const cs = getComputedStyle(cur);
    if (cs.overflowY === 'auto' || cs.overflowY === 'scroll') return cur;
    cur = cur.parentElement;
  }
  return null;
}

/** Max iterations for the refine loop. The initial scroll runs on
 *  cv:auto placeholder heights and may land imprecisely; expect 1–3
 *  refine passes warm, more on cold deep targets. The cap bounds
 *  worst-case latency rather than guaranteeing convergence — capping
 *  out leaves the target on screen, just not perfectly aligned.
 *  Deliberately generous: unneeded iterations exit early via the
 *  tolerance check. */
const MAX_REFINE_ITERATIONS = 10;

/** Convergence tolerance in CSS pixels. */
const REFINE_TOLERANCE_PX = 1;

export type PreciseScrollBlock = 'start' | 'center';

/** Monotonic token — a newer `preciseScrollIntoView` call cancels any in-flight
 *  refine loop from an older one, so a burst of scrolls (e.g. holding "next
 *  match" in find on a large doc) doesn't stack overlapping materialize/refine
 *  passes. Latest scroll wins. */
let scrollGeneration = 0;

/** Escape a value for use inside a CSS attribute selector. */
function cssEscape(s: string): string {
  if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') return CSS.escape(s);
  return s.replace(/[^a-zA-Z0-9_-]/g, (c) => `\\${c}`);
}

/** Scroll a heading into view by its stable `data-id`, the reliable
 *  nav-pane jump path. Returns true when the element was found and
 *  scrolled; false when it isn't in the rendered DOM (e.g. tests, or a
 *  cv:auto-skipped region the caller must fall back for). */
export function scrollToHeadingId(
  view: EditorView,
  headingId: string,
  block: PreciseScrollBlock = 'start',
): boolean {
  const target = view.dom.querySelector<HTMLElement>(`[data-id="${cssEscape(headingId)}"]`);
  if (!target) return false;
  preciseScrollIntoView(view, target, block);
  return true;
}

export function preciseScrollIntoView(
  _view: EditorView,
  target: HTMLElement,
  block: PreciseScrollBlock = 'start',
): void {
  if (!target.isConnected) return;
  const myGen = ++scrollGeneration;

  // Optimistic initial scroll. Browser uses whatever layout it
  // already has — placeholder heights for cv:auto-skipped cards,
  // real heights for materialized ones. May land imprecisely on
  // first call when the target's region was never visited.
  target.scrollIntoView({ behavior: 'auto', block });

  // Where the target should be after a precise scroll, in viewport
  // pixels. `block: 'start'` puts it at the top of the scroller's
  // visible region; `'center'` puts it at the vertical middle.
  // Both `getBoundingClientRect().top` (read below) and the scroller's
  // own rect are viewport-relative, so the convergence check
  // `Math.abs(rect.top - desiredTop)` works in either coordinate
  // space. Falls back to viewport bounds when there's no scrolling
  // ancestor (e.g., tests or DOM detached states).
  const scroller = nearestScroller(target);
  const sb = scroller
    ? scroller.getBoundingClientRect()
    : { top: 0, bottom: window.innerHeight };
  const desiredTop = block === 'center' ? (sb.top + sb.bottom) / 2 : sb.top;

  let iterations = 1;
  const refine = (): void => {
    if (myGen !== scrollGeneration) return; // superseded by a newer scroll
    if (!target.isConnected) return;
    const rect = target.getBoundingClientRect();
    // Converged within tolerance.
    if (Math.abs(rect.top - desiredTop) < REFINE_TOLERANCE_PX) return;
    // Out of budget — target is on screen, possibly misaligned.
    if (iterations >= MAX_REFINE_ITERATIONS) return;
    iterations++;
    // Re-issue scrollIntoView. Each iteration materializes more
    // cards (the previous scroll's destination region is now
    // painted), refining the layout the browser's alignment math
    // runs against.
    //
    // Deliberately no "position didn't change → bail" guard:
    // placeholder-based layout can land scrollIntoView at the same
    // wrong spot two frames in a row while each scroll still
    // advances materialization, so a stable position is not
    // convergence. MAX_REFINE_ITERATIONS is the safety net.
    target.scrollIntoView({ behavior: 'auto', block });
    requestAnimationFrame(refine);
  };
  requestAnimationFrame(refine);
}
