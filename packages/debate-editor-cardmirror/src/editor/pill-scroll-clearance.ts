/**
 * Keep typed text clear of the pill tray (field report 2026-08-05,
 * second report of the same: 2026-07-15).
 *
 * The dropzone / send / receive pills float fixed over the editor's
 * bottom-left corner. The doc already grows a bottom padding runway
 * while the tray is up (style.css, `pmd-pill-tray-active`), so the
 * last lines CAN scroll clear — but ProseMirror's type-time
 * auto-scroll didn't know the bottom strip is obscured, so typing at
 * the end of the doc parked the caret behind the pills and the user
 * had to scroll by hand.
 *
 * PM has first-class props for an obscured edge: `scrollThreshold`
 * (how close to the container edge the caret may get before a scroll
 * kicks in) and `scrollMargin` (how far clear of the edge it lands).
 * This plugin supplies both with a live bottom value measured from
 * the tray each time PM scrolls the selection into view:
 *
 *  - Tray hidden (pairing off, no pills): 0 — PM's stock behavior.
 *  - Multi-pane: the tray overlaps only the pane it anchors to
 *    (`pmd-pane-pill-anchored`, tagged by positionDropzone); other
 *    panes keep stock behavior.
 *  - The measured height is clamped so a fully expanded send panel
 *    (transient, drag/click-time) can't yank the scroll position by
 *    hundreds of pixels mid-keystroke.
 *
 * The values are read through getter properties: PM consults the prop
 * object's sides (`value[side]`) on every scroll pass, so the getters
 * re-measure lazily — no listeners, no invalidation, correct across
 * pill show/hide, panel expansion, and editor zoom (all coordinates
 * are client px on both sides of the comparison).
 *
 * Deliberate non-goal: clicking to park the cursor at the bottom does
 * not scroll (the pointer is already there; PM only applies these on
 * its scrollIntoView passes — typing, arrow keys, paste).
 */

import { Plugin } from 'prosemirror-state';

/** Gap between the tray's top edge and where typed text should sit,
 *  plus the tray's own standoff from the container bottom. */
const BREATHING_PX = 14;
/** Cap so an expanded pill panel can't cause huge scroll jumps. */
const MAX_CLEARANCE_PX = 140;

/** How much of the scroll container's bottom strip the pill tray
 *  obscures for the given editor DOM, in client px. Exported for the
 *  unit tests; measured live per call. */
export function trayBottomClearance(editorDom: HTMLElement): number {
  const doc = editorDom.ownerDocument;
  if (!doc.documentElement.classList.contains('pmd-pill-tray-active')) return 0;
  // In multi-pane, only the tray-anchored pane is overlapped.
  const pane = editorDom.closest('.pmd-pane');
  if (pane && !pane.classList.contains('pmd-pane-pill-anchored')) return 0;
  const tray = doc.querySelector('.pmd-pill-tray') as HTMLElement | null;
  if (!tray) return 0;
  const h = tray.getBoundingClientRect().height;
  if (h <= 0) return 0;
  return Math.min(h + BREATHING_PX, MAX_CLEARANCE_PX);
}

/** Prop-object sides as getters so every PM scroll pass re-measures. */
function liveSides(
  editorDomRef: () => HTMLElement | null,
  base: number,
): { top: number; left: number; right: number; readonly bottom: number } {
  return {
    top: base,
    left: base,
    right: base,
    get bottom(): number {
      const dom = editorDomRef();
      const clearance = dom ? trayBottomClearance(dom) : 0;
      return base + clearance;
    },
  };
}

export function pillScrollClearancePlugin(): Plugin {
  let viewDom: HTMLElement | null = null;
  return new Plugin({
    view(view) {
      viewDom = view.dom;
      return {
        destroy() {
          viewDom = null;
        },
      };
    },
    props: {
      // PM defaults: threshold 0, margin 5 — preserved on the
      // unobscured sides; the bottom adds the live tray clearance.
      scrollThreshold: liveSides(() => viewDom, 0),
      scrollMargin: liveSides(() => viewDom, 5),
    },
  });
}
