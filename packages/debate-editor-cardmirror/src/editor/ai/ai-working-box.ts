/**
 * AiWorkingBox — a single purple box around the OUTER BOUNDS of a doc
 * range, for the "AI is working here" cue on selection-scoped actions
 * (cite/text/format repair, an image). Unlike a ProseMirror inline
 * decoration (which draws a separate rect per line), this is one
 * absolutely-positioned overlay sized to the range's bounding
 * rectangle — the same look as the card container box, just bounded by
 * the selection.
 *
 * Position: `fixed`, viewport coords from the range's
 * `getBoundingClientRect`, repositioned on scroll/resize and whenever
 * the host re-anchors the range (e.g. a repair pass re-maps positions).
 */

import type { EditorView } from 'prosemirror-view';

interface Range {
  from: number;
  to: number;
}

/** The bounding rectangle of `range` in viewport coords, or null. Uses a
 *  DOM Range so it bounds atoms (e.g. an image) correctly, where
 *  `coordsAtPos` returns only a degenerate caret rect. Shared with the
 *  "Thinking…" pill so both cues anchor to the same box. */
export function rangeRect(view: EditorView, range: Range): DOMRect | null {
  if (range.to <= range.from) return null;
  try {
    const a = view.domAtPos(range.from);
    const b = view.domAtPos(range.to);
    const r = document.createRange();
    r.setStart(a.node, a.offset);
    r.setEnd(b.node, b.offset);
    const rect = r.getBoundingClientRect();
    if (rect.width > 0 || rect.height > 0) return rect;
  } catch {
    /* fall through to coordsAtPos */
  }
  try {
    const c1 = view.coordsAtPos(range.from);
    const c2 = view.coordsAtPos(range.to);
    const left = Math.min(c1.left, c2.left);
    const top = Math.min(c1.top, c2.top);
    return new DOMRect(left, top, Math.max(1, Math.abs(c2.left - c1.left)), Math.max(c1.bottom, c2.bottom) - top);
  } catch {
    return null;
  }
}

export class AiWorkingBox {
  private el: HTMLDivElement | null = null;
  private view: EditorView | null = null;
  private range: Range = { from: 0, to: 0 };
  private readonly onScroll = (): void => this.reposition();

  /** `variant` picks the box's look: the default solid purple means
   *  "AI is working here right now"; 'target' is the dashed version
   *  meaning "this is what the open panel will act on" — same colour so
   *  the two read as one idea, different stroke so they never get
   *  confused for each other. */
  constructor(private readonly variant: 'working' | 'target' = 'working') {}

  show(view: EditorView, range: Range): void {
    if (this.el) {
      this.setRange(range);
      return;
    }
    this.view = view;
    this.range = range;
    const el = document.createElement('div');
    el.className =
      this.variant === 'target' ? 'pmd-ai-working-box pmd-ai-target-box' : 'pmd-ai-working-box';
    el.setAttribute('aria-hidden', 'true');
    document.body.appendChild(el);
    this.el = el;
    this.reposition();
    // Capture-phase scroll catches the editor's inner scroller too.
    window.addEventListener('scroll', this.onScroll, true);
    window.addEventListener('resize', this.onScroll);
  }

  setRange(range: Range): void {
    this.range = range;
    this.reposition();
  }

  hide(): void {
    window.removeEventListener('scroll', this.onScroll, true);
    window.removeEventListener('resize', this.onScroll);
    if (this.el) {
      this.el.remove();
      this.el = null;
    }
    this.view = null;
  }

  private reposition(): void {
    if (!this.el || !this.view) return;
    const rect = rangeRect(this.view, this.range);
    if (!rect) {
      this.el.style.display = 'none';
      return;
    }
    const pad = 2;
    this.el.style.display = 'block';
    this.el.style.left = `${rect.left - pad}px`;
    this.el.style.top = `${rect.top - pad}px`;
    this.el.style.width = `${rect.width + pad * 2}px`;
    this.el.style.height = `${rect.height + pad * 2}px`;
  }
}
