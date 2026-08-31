/**
 * DOM/scroll wiring for the sticky heading breadcrumb bar — renders
 * `computeBreadcrumbPath`'s ancestor chain for whichever heading sits at
 * the top of the single-doc scroller (`#app`) and keeps it live across
 * scrolling and edits. See `heading-breadcrumb.ts` for the pure ancestor
 * computation this wraps, and `nav-panel.ts` for the sibling "click a
 * heading to jump" pattern this mirrors (`select`-then-`scrollToHeadingId`
 * from `plugin-jump.ts`).
 *
 * Single-doc only for now (mounted once against `#app`/the single-doc
 * `view`); multi-pane/multi-window each have their own `.pmd-pane-body`
 * scroller and view and are not wired up — a follow-up, not a regression,
 * since neither had a breadcrumb before this file existed.
 *
 * @module editor/heading-breadcrumb-bar
 */

import type { EditorView } from 'prosemirror-view';
import type { Node as PMNode } from 'prosemirror-model';
import { TextSelection } from 'prosemirror-state';
import { collectHeadings, TYPE_LABEL, type HeadingEntry } from './headings.js';
import { computeBreadcrumbPath, shouldShowBreadcrumb } from './heading-breadcrumb.js';
import { scrollToHeadingId } from './precise-scroll.js';

export class HeadingBreadcrumbBar {
  private view: EditorView | null = null;
  private raf: number | null = null;
  private enabled = true;

  constructor(
    private readonly el: HTMLElement,
    private readonly scroller: HTMLElement,
  ) {
    this.scroller.addEventListener('scroll', this.onScroll, { passive: true });
  }

  /** Gate the bar behind the `showHeadingBreadcrumb` setting. Off hides
   *  it unconditionally, even where a heading is currently in scope; on
   *  restores whatever the current scroll position would otherwise show. */
  setEnabled(enabled: boolean): void {
    if (this.enabled === enabled) return;
    this.enabled = enabled;
    if (!enabled) {
      // Reuse render()'s own hide path (an empty ancestor chain always
      // hides, via `shouldShowBreadcrumb`) rather than duplicating it here.
      this.render([]);
    } else {
      this.refresh();
    }
  }

  /** Call once the single-doc view exists (mirrors `navPanel.attach`). */
  attach(view: EditorView): void {
    this.view = view;
    this.refresh();
  }

  /** Call after the doc changes (mirrors `navPanel.update`) so headings
   *  that shifted or were retitled near the current scroll position are
   *  reflected without waiting for the next scroll event. */
  update(_doc: PMNode): void {
    this.refresh();
  }

  destroy(): void {
    this.scroller.removeEventListener('scroll', this.onScroll);
    if (this.raf != null) cancelAnimationFrame(this.raf);
  }

  private onScroll = (): void => {
    if (this.raf != null) return;
    this.raf = requestAnimationFrame(() => {
      this.raf = null;
      this.refresh();
    });
  };

  private refresh(): void {
    if (!this.enabled) return;
    const view = this.view;
    if (!view) return;
    const scrollerRect = this.scroller.getBoundingClientRect();
    const barHeight = this.el.getBoundingClientRect().height;
    const probeX = scrollerRect.left + scrollerRect.width / 2;
    // Probe just below the bar's own height (0 while hidden), then a few
    // increasing offsets: the doc's own top padding/margin (most visible
    // right at scrollTop 0, before any heading's box begins) can put a
    // 4px probe in a gap `posAtCoords` resolves as no hit at all. Widening
    // the search — rather than keeping the last render on a miss, as a
    // single-probe version of this did — is what actually fixes a stale
    // breadcrumb at the top of the doc; a genuine miss (nothing below the
    // bar at any of these offsets) is rare enough to just skip the update.
    const hit = [4, 20, 48].map((dy) => view.posAtCoords({ left: probeX, top: scrollerRect.top + barHeight + dy })).find((r) => r != null);
    if (!hit) return;
    const headings = collectHeadings(view.state.doc, { skipCite: true });
    this.render(computeBreadcrumbPath(headings, hit.pos));
  }

  private render(path: HeadingEntry[]): void {
    if (!shouldShowBreadcrumb(this.enabled, path)) {
      this.el.hidden = true;
      this.el.replaceChildren();
      return;
    }
    this.el.hidden = false;
    const frag = document.createDocumentFragment();
    path.forEach((entry, i) => {
      if (i > 0) {
        const sep = document.createElement('span');
        sep.className = 'pmd-breadcrumb-sep';
        sep.textContent = '›';
        sep.setAttribute('aria-hidden', 'true');
        frag.appendChild(sep);
      }
      const label = entry.text.trim() || TYPE_LABEL[entry.type] || entry.type;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'pmd-breadcrumb-segment';
      btn.textContent = label;
      btn.title = `Jump to this ${TYPE_LABEL[entry.type] ?? entry.type}`;
      btn.addEventListener('click', () => this.jumpTo(entry));
      frag.appendChild(btn);
    });
    this.el.replaceChildren(frag);
  }

  private jumpTo(entry: HeadingEntry): void {
    const view = this.view;
    if (!view) return;
    const tr = view.state.tr;
    tr.setSelection(TextSelection.create(tr.doc, Math.min(entry.pos + 1, tr.doc.content.size)));
    view.dispatch(tr);
    if (!entry.id || !scrollToHeadingId(view, entry.id)) {
      view.dispatch(view.state.tr.scrollIntoView());
    }
    view.focus();
  }
}
