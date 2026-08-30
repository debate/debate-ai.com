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
