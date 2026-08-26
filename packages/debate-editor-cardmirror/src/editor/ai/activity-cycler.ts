/**
 * Cycling activity-text "stage" used by the comments-column
 * Thinking… placeholder and the cite-creator tooltip.
 *
 * The stage is a small variable-height container. At any time it
 * holds one line "at rest" (the current activity). On `cycleActivityText`
 * we insert a new line at the bottom (translated 100% down, opacity 0),
 * shift it into the rest position, and simultaneously slide the
 * old line out the top (translate -100%, opacity 0). When the old
 * line's transition finishes it's removed.
 *
 * The lines are absolutely positioned so the in/out animations don't
 * push surrounding content around. That means the lines don't
 * contribute to the stage's intrinsic height. To support multi-line
 * activities we observe whichever line is currently at rest and
 * push its measured height onto `stage.style.height`, with a CSS
 * height transition so growth/shrink reads as a smooth resize.
 */

/** ResizeObserver tracking the current rest line for each stage,
 *  keyed by stage element. Re-pointed each cycle. */
const stageObservers = new WeakMap<HTMLElement, ResizeObserver>();

/** Point the stage's geometry-tracking observer at `line`. The
 *  observer pushes the line's measured width AND height onto
 *  `stage.style.width` / `.height` so the stage grows / shrinks to
 *  fit the current rest line. The width-tracking half is what
 *  lets the AI tooltip pill auto-fit content like a chip instead
 *  of sitting at a fixed `min-width`. Stages that opt out of width
 *  tracking (the comments column's placeholder, where the column
 *  dictates the width) carry the `pmd-activity-stage-fixed-width`
 *  class. */
function trackGeometry(stage: HTMLElement, line: HTMLElement): void {
  if (typeof ResizeObserver === 'undefined') return;
  const existing = stageObservers.get(stage);
  if (existing) existing.disconnect();
  const fixedWidth = stage.classList.contains('pmd-activity-stage-fixed-width');
  const apply = (): void => {
    const rect = line.getBoundingClientRect();
    if (rect.height > 0) stage.style.height = `${rect.height}px`;
    if (!fixedWidth && rect.width > 0) stage.style.width = `${rect.width}px`;
  };
  const ro = new ResizeObserver(apply);
  ro.observe(line);
  stageObservers.set(stage, ro);
  // First measurement: ResizeObserver fires after a layout pass, but
  // the stage may not yet be in the DOM at construction time. rAF
  // covers both the in-DOM and just-mounted cases.
  requestAnimationFrame(apply);
}

/** Build a fresh stage element pre-populated with one resting line. */
export function makeActivityStage(initialText: string): HTMLSpanElement {
  const stage = document.createElement('span');
  stage.className = 'pmd-activity-stage';
  const line = document.createElement('span');
  line.className = 'pmd-activity-line pmd-activity-rest';
  line.textContent = initialText;
  stage.appendChild(line);
  trackGeometry(stage, line);
  return stage;
}

/** Swap the stage's current text for `newText` with an animated
 *  scroll-up transition. Safe to call repeatedly — each call
 *  cleans up the previous outgoing line before the next starts.
 *  No-op when `newText` is the same as the current line. */
export function cycleActivityText(stage: HTMLElement, newText: string): void {
  const current = stage.querySelector<HTMLElement>(
    '.pmd-activity-line.pmd-activity-rest',
  );
  if (current && current.textContent === newText) return;

  const next = document.createElement('span');
  next.className = 'pmd-activity-line pmd-activity-in';
  next.textContent = newText;
  stage.appendChild(next);
  // Force a layout read so the `.pmd-activity-in` (translated down,
  // opacity 0) state actually commits before we ask the browser to
  // animate to the rest state. Without this read the browser may
  // collapse the two style changes into a single jump.
  void next.getBoundingClientRect();
  next.classList.remove('pmd-activity-in');
  next.classList.add('pmd-activity-rest');
  trackGeometry(stage, next);

  if (current) {
    current.classList.remove('pmd-activity-rest');
    current.classList.add('pmd-activity-out');
    let removed = false;
    const remove = (): void => {
      if (removed) return;
      removed = true;
      current.remove();
    };
    current.addEventListener('transitionend', remove, { once: true });
    // Belt-and-suspenders: drop the element after the transition
    // duration even if `transitionend` doesn't fire (e.g. the
    // browser threw the tab into background mid-transition).
    window.setTimeout(remove, 600);
  }
}
