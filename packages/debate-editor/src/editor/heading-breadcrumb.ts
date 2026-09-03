/**
 * Pure ancestor-chain computation for the sticky heading breadcrumb — the
 * "(c) a sticky breadcrumb showing the current heading while scrolling"
 * follow-up named under TODO.md idea #9 ("Expandable Heading Structure").
 * Kept separate from `heading-breadcrumb-bar.ts`'s DOM/scroll wiring so
 * this stays unit-testable without mocking the DOM, mirroring
 * `headings.ts`'s own split from `nav-panel.ts`.
 *
 * @module editor/heading-breadcrumb
 */

import type { HeadingEntry } from './headings.js';

/**
 * Builds the root-to-current ancestor chain for the heading at or
 * immediately before `pos`, from `headings` — the flat, doc-order list
 * `collectHeadings` returns.
 *
 * Single forward pass maintaining a level-ordered stack: any entry whose
 * level is >= the top of the stack pops it first (a sibling or shallower
 * heading ends every deeper chain below it), then the entry itself is
 * pushed. Doc order + level comparisons alone are enough to reconstruct
 * the ancestor chain — no parent pointers needed, the same trick
 * `sectionEndFromHeading` in `headings.ts` uses for sibling spans.
 *
 * Returns `[]` when `pos` is before every heading (or there are none).
 */
export function computeBreadcrumbPath(headings: HeadingEntry[], pos: number): HeadingEntry[] {
  const stack: HeadingEntry[] = [];
  for (const entry of headings) {
    if (entry.pos > pos) break;
    while (stack.length > 0 && stack[stack.length - 1]!.level >= entry.level) {
      stack.pop();
    }
    stack.push(entry);
  }
  return stack;
}

/**
 * Whether the breadcrumb bar should render, given the `showHeadingBreadcrumb`
 * setting and the current ancestor path from `computeBreadcrumbPath`. Off
 * unconditionally hides the bar, even where a heading is in scope; on shows
 * it whenever the path is non-empty (the usual "no heading above the scroll
 * position yet" case still hides it). Pure so `HeadingBreadcrumbBar`'s DOM
 * wiring can stay a thin caller, mirroring `computeBreadcrumbPath` itself.
 */
export function shouldShowBreadcrumb(enabled: boolean, path: HeadingEntry[]): boolean {
  return enabled && path.length > 0;
}
