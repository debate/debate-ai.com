/**
 * Pointer-centric drag auto-scroll.
 *
 * During a drag, scroll the vertically-scrollable container *directly under the
 * pointer* when the pointer nears that container's top/bottom edge. Being
 * pointer-centric (rather than tied to the drag's source surface) is what makes
 * it work across panes: dragging from any nav/editor over any other nav/editor —
 * or within one — scrolls whatever the pointer is hovering. Driven once per move
 * from the drag controller's `setPointer`.
 *
 * The downward scroll is suppressed over the bottom-left pill tray (dropzone /
 * send / receive pills) so a drag toward those isn't fought by scrolling.
 */

import { pointerOverPillTrayColumn } from './pill-tray.js';

const MARGIN = 30;
const STEP = 10;

/** Nudge the nearest vertically-scrollable ancestor of the element under the
 *  pointer if the pointer is within MARGIN of its top/bottom edge. */
export function autoScrollUnderPointer(clientX: number, clientY: number): void {
  // The drag preview (pickup pill) is `pointer-events: none`, so this hit-tests
  // through to the real surface beneath it.
  let el: Element | null = document.elementFromPoint(clientX, clientY);
  while (el && el !== document.body && el !== document.documentElement) {
    if (canScrollVertically(el)) {
      const r = el.getBoundingClientRect();
      // The up-band starts below any sticky header pinned at the container's
      // top (e.g. the multi-pane nav's sticky header), so it doesn't sit
      // permanently behind it.
      if (clientY < r.top + stickyTopInset(el, r) + MARGIN) {
        el.scrollBy({ top: -STEP });
      } else if (clientY > r.bottom - MARGIN && !pointerOverPillTrayColumn(clientX)) {
        el.scrollBy({ top: STEP });
      }
      return;
    }
    el = el.parentElement;
  }
}

function canScrollVertically(el: Element): boolean {
  if (el.scrollHeight <= el.clientHeight) return false;
  const oy = getComputedStyle(el).overflowY;
  return oy === 'auto' || oy === 'scroll';
}

/** Height of a sticky element pinned at the top of `container`'s viewport (its
 *  bottom relative to the container's top), or 0 if there isn't one. Probes the
 *  element at the container's top edge and walks up to the container looking for
 *  `position: sticky`. */
function stickyTopInset(container: Element, r: DOMRect): number {
  const probeX = Math.round(r.left + Math.min(20, r.width / 2));
  let node: Element | null = document.elementFromPoint(probeX, Math.round(r.top + 1));
  while (node && node !== container) {
    if (getComputedStyle(node).position === 'sticky') {
      return Math.max(0, node.getBoundingClientRect().bottom - r.top);
    }
    node = node.parentElement;
  }
  return 0;
}
