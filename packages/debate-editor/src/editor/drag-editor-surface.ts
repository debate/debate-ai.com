/**
 * Editor surface for cross-surface drag-and-drop.
 *
 * Phase 3a (nav→text): when ANY drag is active, this surface renders
 * drop indicators in the editor (horizontal lines spanning the
 * editor's width at top-of-each-heading positions, plus an end-of-doc
 * slot) and hits-tests them so the controller can land a drop here.
 * Indicator rendering is driven by subscription to the drag controller
 * — no need for the source surface to call us directly.
 *
 * Phase 3b (text→nav): when the user holds the pickup modifier
 * (Ctrl+Alt+Shift on Linux/Win, Cmd+Option+Shift on Mac), the editor
 * enters "pickup mode": the cursor changes to grab; hovering shows a
 * dashed-outline overlay around the smallest enclosing recognized
 * container under the pointer (Card / Block / Hat / Pocket / Analytic-
 * unit, smallest wins). A pointerdown in pickup mode begins a drag
 * with that container as the source. Releasing the modifier mid-drag
 * cancels.
 */

import type { EditorView } from 'prosemirror-view';
import { collectHeadings, headingInsertPos, TYPE_TO_LEVEL, sectionEndFromHeading } from './headings.js';
import { dragController, type DragItem, type DragSurface } from './drag-controller.js';
import { isTransclusionNode } from './transclusion.js';
import { isSelfRef } from './self-transclusion.js';
import { settings } from './settings.js';
import { scheduleIdle, cancelIdle, type IdleHandle } from './idle-scheduler.js';

interface IndicatorRecord {
  el: HTMLElement;
  insertPos: number;
}

interface HoveredContainer {
  from: number;
  to: number;
  type: string;
  level: number;
  label: string;
}

export class EditorDragSurface implements DragSurface {
  private view: EditorView | null = null;
  private host: HTMLElement | null = null;
  private indicators: IndicatorRecord[] = [];

  // Phase 3b state.
  private pickupModifierHeld = false;
  private hovered: HoveredContainer | null = null;
  private highlightBox: HTMLElement | null = null;
  private dragOriginatedHere = false;
  private editorPointerMoveAttached = false;
  /** Last known pointer position (cached from a global mousemove
   *  listener). Used to do an immediate hit-test when the pickup
   *  modifier activates — without this, the user would have to move
   *  the mouse before seeing the highlight. */
  private lastClientX = -1;
  private lastClientY = -1;

  // Subscriptions / cleanups.
  private unsubscribeDrag: (() => void) | null = null;
  private unregisterSurface: (() => void) | null = null;

  // Bound handlers.
  private boundOnKey = (e: KeyboardEvent) => this.onKey(e);
  private boundOnBlur = () => this.onBlur();
  private boundOnGlobalMove = (e: MouseEvent) => this.onGlobalMove(e);
  private boundOnHostMove = (e: PointerEvent) => this.onHostPointerMove(e);
  private boundOnHostDown = (e: PointerEvent) => this.onHostPointerDown(e);
  private boundOnHostMouseDown = (e: MouseEvent) => this.onHostMouseDown(e);
  private boundOnDocMove = (e: PointerEvent) => this.onDocPointerMoveDuringDrag(e);
  private boundOnDocUp = (e: PointerEvent) => this.onDocPointerUpDuringDrag(e);

  /** Cached scroll-gate element (the nearest scrolling ancestor of
   *  host, or host itself). Reused by every hit-test so we don't
   *  walk the DOM on every pointermove. */
  private scrollGateEl: HTMLElement | null = null;

  // ---- Heading-visibility tracking (for drop-indicator rendering) ----
  //
  // Cards / heading containers have `content-visibility: auto`, which
  // means off-screen subtrees are skipped from layout. Querying
  // `offsetTop` of a descendant of a skipped subtree forces the
  // browser to materialize that subtree's layout — and the
  // drop-indicator code does that for every heading in the doc.
  // On a long doc this is hundreds of ms of forced layout.
  //
  // Solution: maintain an IntersectionObserver continuously, tracking
  // which heading elements are currently within (or near) the
  // viewport. Drop indicators are rendered ONLY for the visible
  // subset — those elements are already laid out so the offsetTop
  // reads are fast. As the user scrolls during a drag, the IO fires
  // and we re-render indicators for the newly-visible subset.
  /** Per-element visibility flag, fed by the IntersectionObserver. */
  private visibleHeadings: Set<HTMLElement> = new Set();
  /** Whether `view.dom.lastElementChild` is currently in viewport.
   *  Drives whether the doc-end indicator renders. */
  private visibleLastChild = false;
  /** The set of elements currently observed by the IO. Refreshed
   *  whenever PM mutates the doc structure. */
  private observedHeadings: Set<HTMLElement> = new Set();
  private observedLastChild: HTMLElement | null = null;
  private headingIO: IntersectionObserver | null = null;
  /** MutationObserver watching `view.dom` for added / removed
   *  heading nodes. Fires after every PM transaction — debounced
   *  via the idle scheduler so we don't pay this cost per keystroke. */
  private headingMutObserver: MutationObserver | null = null;
  private refreshHeadingObsHandle: IdleHandle | null = null;

  /** Return the host's own scroller if it has one, otherwise the
   *  nearest ancestor whose `overflow-y` allows scrolling. Used by
   *  `hitTest` to decide whether the cursor is "inside the editor's
   *  visible drop region" — see the comment in `hitTest`. */
  private findScrollGate(): HTMLElement {
    if (this.scrollGateEl && this.scrollGateEl.isConnected) return this.scrollGateEl;
    let cur: HTMLElement | null = this.host;
    while (cur && cur !== document.body) {
      const overflow = getComputedStyle(cur).overflowY;
      if (overflow === 'auto' || overflow === 'scroll') {
        this.scrollGateEl = cur;
        return cur;
      }
      cur = cur.parentElement;
    }
    // Fall back to host (e.g., single-doc host that doesn't scroll
    // either, or a detached host during teardown).
    this.scrollGateEl = this.host;
    return this.host!;
  }

  attach(view: EditorView, hostEl: HTMLElement): void {
    this.view = view;
    this.host = hostEl;
    this.scrollGateEl = null;
    if (!hostEl.style.position) hostEl.style.position = 'relative';

    this.unregisterSurface = dragController.registerSurface(this);
    this.unsubscribeDrag = dragController.subscribe((event) => {
      if (event === 'begin') {
        // Eager render at drag start, not lazily on first hitTest:
        // lazy rendering leaves cross-pane drop targets (multi-doc
        // mode) without indicators when the pointer enters them. The
        // layout-batched renderIndicators keeps the cost moderate.
        const session = dragController.getSession();
        if (session) this.renderIndicators(session.items[0]!.level);
      } else if (event === 'end') {
        this.removeIndicators();
        this.dragOriginatedHere = false;
        this.detachDragListeners();
        // Re-evaluate cursor based on current modifier state.
        this.applyPickupClass();
      }
    });

    document.addEventListener('keydown', this.boundOnKey);
    document.addEventListener('keyup', this.boundOnKey);
    document.addEventListener('mousemove', this.boundOnGlobalMove);
    window.addEventListener('blur', this.boundOnBlur);
    hostEl.addEventListener('pointermove', this.boundOnHostMove);
    // Capture phase: a pickup-drag pointerdown must be intercepted
    // BEFORE ProseMirror's own handler on the inner editable, or PM
    // sets a (Shift/Alt-modified) text selection under the click.
    // While the chord is held, EVERY left click is swallowed (not
    // just container hits): Blink's macOS editing behavior treats
    // Option+Shift+click as word-granularity selection on mousedown,
    // and `user-select: none` does not apply inside contenteditable —
    // swallowing only container hits leaves every other chord-click
    // selecting words on Mac. The mousedown interceptor is the belt
    // to pointerdown's braces: selection runs off the mouse-event
    // stream.
    hostEl.addEventListener('pointerdown', this.boundOnHostDown, true);
    hostEl.addEventListener('mousedown', this.boundOnHostMouseDown, true);
    this.setupHeadingObservers();
  }

  private onGlobalMove(e: MouseEvent): void {
    this.lastClientX = e.clientX;
    this.lastClientY = e.clientY;
  }

  detach(): void {
    if (this.unregisterSurface) {
      this.unregisterSurface();
      this.unregisterSurface = null;
    }
    if (this.unsubscribeDrag) {
      this.unsubscribeDrag();
      this.unsubscribeDrag = null;
    }
    document.removeEventListener('keydown', this.boundOnKey);
    document.removeEventListener('keyup', this.boundOnKey);
    document.removeEventListener('mousemove', this.boundOnGlobalMove);
    window.removeEventListener('blur', this.boundOnBlur);
    if (this.host) {
      this.host.removeEventListener('pointermove', this.boundOnHostMove);
      this.host.removeEventListener('pointerdown', this.boundOnHostDown, true);
      this.host.removeEventListener('mousedown', this.boundOnHostMouseDown, true);
      this.host.classList.remove('pmd-editor-pickup-mode');
      this.host.classList.remove('pmd-editor-dragging-mode');
    }
    this.detachDragListeners();
    this.removeIndicators();
    this.removeHighlight();
    this.teardownHeadingObservers();
    this.hovered = null;
    this.pickupModifierHeld = false;
    this.dragOriginatedHere = false;
    this.view = null;
    this.host = null;
  }

  // ---- DragSurface implementation ----

  hitTest(clientX: number, clientY: number): { el: HTMLElement; insertPos: number; dy: number; view?: EditorView } | null {
    if (!this.host) return null;
    // For the hit-test gate, use the nearest SCROLLING ancestor — in
    // single-doc that's `#app` (the editor's scroll container), NOT the
    // host (`#editor`) itself; in multi-doc it's the pane body (the host
    // `.pmd-pane-editor` has overflow:visible and its element box is
    // locked to the body's visible height while PM's content overflows
    // further down). Using the host's own rect rejects every cursor
    // below its box even though the editor content extends past it.
    const gateRect = this.findScrollGate().getBoundingClientRect();
    if (clientX < gateRect.left || clientX > gateRect.right) {
      return null;
    }
    // Generous vertical clamp so we don't claim drops far outside the
    // editor's visible area (e.g., user dragging over a totally
    // unrelated page region above or below).
    if (clientY < gateRect.top - 64 || clientY > gateRect.bottom + 64) {
      return null;
    }

    const session = dragController.getSession();
    type Cand = { el: HTMLElement; insertPos: number; centerY: number; dy: number };
    const valid: Cand[] = [];
    for (const r of this.indicators) {
      if (session) {
        const onSelf = session.items.some(
          (it) => r.insertPos > it.from && r.insertPos < it.to,
        );
        if (onSelf) continue;
      }
      const rect = r.el.getBoundingClientRect();
      const centerY = rect.top + rect.height / 2;
      valid.push({ el: r.el, insertPos: r.insertPos, centerY, dy: Math.abs(clientY - centerY) });
    }
    if (valid.length === 0) return null;

    const view = this.view ?? undefined;
    // Preferred: closest indicator within 32px band.
    let best: Cand | null = null;
    for (const v of valid) {
      if (v.dy > 32) continue;
      if (!best || v.dy < best.dy) best = v;
    }
    if (best) return { el: best.el, insertPos: best.insertPos, dy: best.dy, view };

    // Fall-through: pointer is above the topmost or below the
    // bottommost indicator (e.g., empty page space at the bottom).
    // Snap to the closest extreme.
    let topMost = valid[0]!;
    let bottomMost = valid[0]!;
    for (const v of valid) {
      if (v.centerY < topMost.centerY) topMost = v;
      if (v.centerY > bottomMost.centerY) bottomMost = v;
    }
    if (clientY > bottomMost.centerY) {
      return { el: bottomMost.el, insertPos: bottomMost.insertPos, dy: bottomMost.dy, view };
    }
    if (clientY < topMost.centerY) {
      return { el: topMost.el, insertPos: topMost.insertPos, dy: topMost.dy, view };
    }
    return null;
  }

  highlight(el: HTMLElement | null): void {
    for (const r of this.indicators) {
      r.el.classList.toggle('pmd-editor-drop-indicator-active', r.el === el);
    }
  }

  // ---- Indicator rendering (drop targets) ----

  private renderIndicators(draggedLevel: number): void {
    this.removeIndicators();
    if (!this.view || !this.host) return;
    // Reading view locks all structural edits (its filterTransaction
    // has no drag exception), so drop targets are pure noise there —
    // render none. The lock would reject the drop anyway; this keeps
    // the editor from advertising one.
    if (this.host.classList.contains('pmd-reader-view')) return;
    const view = this.view;
    const host = this.host;

    // Use each heading's rendered DOM element to derive its CSS top
    // INSIDE the host (`offsetTop` walks the offsetParent chain),
    // rather than `view.coordsAtPos` plus a viewport→host transform
    // via `getBoundingClientRect` and `scrollTop`. That transform
    // assumes the host is the scroll container — true in single-doc,
    // but in multi-doc the pane *body* scrolls, and the transform
    // collapses all indicators near the top of the host's content.
    // Offsets sidestep the viewport coordinate space entirely.
    const positions: { insertPos: number; top: number }[] = [];
    const seen = new Set<number>();
    const pushPos = (insertPos: number, top: number): void => {
      if (seen.has(insertPos)) return;
      seen.add(insertPos);
      positions.push({ insertPos, top });
    };
    // Build a fast id→element map from the currently-visible heading
    // set so we can render indicators only for headings the user can
    // actually see. Headings outside the viewport stay
    // `content-visibility: auto`-skipped — querying their offsetTop
    // would force the browser to materialize their ancestor layout,
    // which is the slow path we're avoiding. The IntersectionObserver
    // (`headingIO`) keeps `visibleHeadings` current.
    const visibleIdToEl = new Map<string, HTMLElement>();
    for (const el of this.visibleHeadings) {
      const id = el.dataset['id'];
      if (id) visibleIdToEl.set(id, el);
    }
    const doc = view.state.doc;
    // Is the drag source a doc-level opaque unit — a whole live zone (linked copy)
    // or a live view? Then it drops as a doc-level unit (not level-scoped) and
    // offers no target inside any zone. Checked across ALL items, not items[0]:
    // a mixed multi-select (a promoted whole zone + a plain heading) must scope
    // its slots the same way regardless of which item sits first in doc order.
    const session = dragController.getSession();
    const srcIsZone =
      !!session &&
      session.items.some((it) => {
        const n = session.view.state.doc.nodeAt(it.from);
        return !!n && (isTransclusionNode(n) || isSelfRef(n));
      });
    // `skipCite: true` — drop-indicator placement doesn't read
    // `entry.cite`, and the cite walk is the heaviest part of
    // `collectHeadings` (it descends every card looking for
    // cite-marked text runs).
    let prevZonePos: number | null = null;
    for (const entry of collectHeadings(doc, { skipCite: true })) {
      // A live zone is opaque to drops: keep only the run's FIRST transcluded
      // entry, remapped to BEFORE the zone (so a top-of-zone drop lands outside
      // it); drop inner transcluded slots so nothing lands between transcluded
      // cards and a zone can't nest.
      const isRunFirst = entry.zonePos != null && entry.zonePos !== prevZonePos;
      prevZonePos = entry.zonePos;
      if (entry.zonePos != null) {
        if (!isRunFirst) continue;
      } else if (!srcIsZone && entry.level > draggedLevel) {
        // §14: slots exist between siblings of level <= dragged level — except a
        // whole-zone drag, which may drop at any doc-level boundary.
        continue;
      }
      const id = entry.id;
      if (!id) continue;
      const el = visibleIdToEl.get(id);
      if (!el) continue;
      // Visibility gate first — skipping off-screen headings keeps pickup snappy.
      // We only need the start position: `headingInsertPos` for a normal heading,
      // or the zone's own doc-level position for a transcluded run-first entry.
      const insertPos = entry.zonePos != null ? entry.zonePos : headingInsertPos(doc, entry);
      if (insertPos == null) continue;
      // Heading is in-viewport, so its ancestors are already laid out
      // and the offsetTop read is cheap.
      const topInHost = offsetTopWithin(el, host);
      if (topInHost == null) continue;
      pushPos(insertPos, topInHost);
    }
    // Doc-end indicator: same visibility gate. The last child is
    // observed separately because it may not carry `data-id`.
    const docEnd = view.state.doc.content.size;
    if (!seen.has(docEnd) && this.visibleLastChild) {
      const lastChild = view.dom.lastElementChild as HTMLElement | null;
      if (lastChild) {
        const topInHost = offsetTopWithin(lastChild, host);
        if (topInHost != null) pushPos(docEnd, topInHost + lastChild.offsetHeight);
      }
    }

    // Single DOM append via a fragment — per-indicator appends would
    // thrash layout.
    const fragment = document.createDocumentFragment();
    for (const { insertPos, top } of positions) {
      const indicator = document.createElement('div');
      indicator.className = 'pmd-editor-drop-indicator';
      indicator.style.top = `${top}px`;
      fragment.appendChild(indicator);
      this.indicators.push({ el: indicator, insertPos });
    }
    host.appendChild(fragment);
  }

  private removeIndicators(): void {
    for (const r of this.indicators) r.el.remove();
    this.indicators = [];
  }

  // ---- Heading visibility tracking ----

  /** Stand up the IntersectionObserver + MutationObserver that keep
   *  `visibleHeadings` and `visibleLastChild` current. Called once
   *  from `attach`. */
  private setupHeadingObservers(): void {
    if (!this.view) return;
    this.headingIO = new IntersectionObserver(
      (entries) => this.onHeadingsIntersection(entries),
      // `root: null` = viewport. The doc-end / heading elements live
      // inside a scroll container that's itself inside the viewport,
      // so viewport intersection correctly tracks user-visible state
      // for both single-doc (`#editor` may or may not scroll) and
      // multi-pane (each pane body scrolls inside its own pane).
      // 50% rootMargin keeps a viewport-sized buffer of indicators
      // rendered above and below the visible region so the user
      // doesn't see them pop in as they scroll during a drag.
      { root: null, rootMargin: '50%', threshold: 0 },
    );
    this.headingMutObserver = new MutationObserver(() => this.scheduleHeadingObsRefresh());
    this.headingMutObserver.observe(this.view.dom, { childList: true, subtree: true });
    // Initial population — observe everything currently rendered.
    this.refreshHeadingObservations();
  }

  private teardownHeadingObservers(): void {
    if (this.refreshHeadingObsHandle !== null) {
      cancelIdle(this.refreshHeadingObsHandle);
      this.refreshHeadingObsHandle = null;
    }
    if (this.headingMutObserver) {
      this.headingMutObserver.disconnect();
      this.headingMutObserver = null;
    }
    if (this.headingIO) {
      this.headingIO.disconnect();
      this.headingIO = null;
    }
    this.observedHeadings.clear();
    this.observedLastChild = null;
    this.visibleHeadings.clear();
    this.visibleLastChild = false;
  }

  /** PM mutations fire as a burst — debounce the re-observe via the
   *  idle scheduler so we don't pay this cost on every keystroke. */
  private scheduleHeadingObsRefresh(): void {
    if (this.refreshHeadingObsHandle !== null) return;
    this.refreshHeadingObsHandle = scheduleIdle(() => {
      this.refreshHeadingObsHandle = null;
      this.refreshHeadingObservations();
    }, 250);
  }

  /** Sync IO observations with the current set of `[data-id]`
   *  elements in `view.dom` plus the doc's last child (for the
   *  doc-end indicator). Adds new observations, drops stale ones. */
  private refreshHeadingObservations(): void {
    if (!this.view || !this.headingIO) return;
    const heads = this.view.dom.querySelectorAll<HTMLElement>('[data-id]');
    const next = new Set<HTMLElement>();
    for (const el of heads) next.add(el);
    // Unobserve elements no longer present.
    for (const el of this.observedHeadings) {
      if (!next.has(el)) {
        this.headingIO.unobserve(el);
        this.visibleHeadings.delete(el);
      }
    }
    // Observe elements newly present.
    for (const el of next) {
      if (!this.observedHeadings.has(el)) {
        this.headingIO.observe(el);
      }
    }
    this.observedHeadings = next;
    // Doc-end last-child tracking. Re-attach when it changes.
    const lastChild = this.view.dom.lastElementChild as HTMLElement | null;
    if (lastChild !== this.observedLastChild) {
      if (this.observedLastChild) {
        this.headingIO.unobserve(this.observedLastChild);
        this.visibleLastChild = false;
      }
      if (lastChild) this.headingIO.observe(lastChild);
      this.observedLastChild = lastChild;
    }
  }

  private onHeadingsIntersection(entries: IntersectionObserverEntry[]): void {
    let changed = false;
    for (const e of entries) {
      const el = e.target as HTMLElement;
      if (e.isIntersecting) {
        if (el === this.observedLastChild && !this.visibleLastChild) {
          this.visibleLastChild = true;
          changed = true;
        }
        if (el.hasAttribute('data-id') && !this.visibleHeadings.has(el)) {
          this.visibleHeadings.add(el);
          changed = true;
        }
      } else {
        if (el === this.observedLastChild && this.visibleLastChild) {
          this.visibleLastChild = false;
          changed = true;
        }
        if (this.visibleHeadings.has(el)) {
          this.visibleHeadings.delete(el);
          changed = true;
        }
      }
    }
    // If a drag is currently active and the visible set shifted (e.g.
    // user scrolled the pane), re-render indicators to cover the
    // newly-visible region.
    if (changed && dragController.isActive()) {
      const session = dragController.getSession();
      if (session) this.renderIndicators(session.items[0]!.level);
    }
  }

  // ---- Modifier-pickup mode ----

  private onKey(e: KeyboardEvent): void {
    const nowHeld = this.isPickupModifierEvent(e);
    if (nowHeld === this.pickupModifierHeld) return;
    this.pickupModifierHeld = nowHeld;
    if (nowHeld) {
      // Activated. Run an immediate hit-test from the cached pointer
      // position so the user sees the highlight without needing to
      // wiggle the mouse.
      this.refreshHoverFromCachedPointer();
    } else {
      this.removeHighlight();
      this.hovered = null;
      // Modifier released mid-drag → cancel the drag.
      if (dragController.isActive() && this.dragOriginatedHere) {
        dragController.cancel();
      }
    }
    this.applyPickupClass();
  }

  private refreshHoverFromCachedPointer(): void {
    if (this.lastClientX < 0 || this.lastClientY < 0) return;
    if (dragController.isActive()) return;
    if (!this.host) return;
    // Only do anything if the cached position is over the editor.
    const rect = this.host.getBoundingClientRect();
    if (
      this.lastClientX < rect.left ||
      this.lastClientX > rect.right ||
      this.lastClientY < rect.top ||
      this.lastClientY > rect.bottom
    ) {
      return;
    }
    const container = this.findContainerAt(this.lastClientX, this.lastClientY);
    if (!container) return;
    this.hovered = container;
    this.showHighlight(container.from, container.to);
  }

  private isPickupModifierEvent(e: KeyboardEvent): boolean {
    return e.shiftKey && e.altKey && (e.ctrlKey || e.metaKey);
  }

  private onBlur(): void {
    if (!this.pickupModifierHeld) return;
    this.pickupModifierHeld = false;
    this.removeHighlight();
    this.hovered = null;
    if (dragController.isActive() && this.dragOriginatedHere) {
      dragController.cancel();
    }
    this.applyPickupClass();
  }

  private applyPickupClass(): void {
    if (!this.host) return;
    const inPickup = this.pickupModifierHeld && !dragController.isActive();
    this.host.classList.toggle('pmd-editor-pickup-mode', inPickup);
    this.host.classList.toggle(
      'pmd-editor-dragging-mode',
      dragController.isActive() && this.dragOriginatedHere,
    );
  }

  private onHostPointerMove(e: PointerEvent): void {
    if (dragController.isActive()) return; // drag handlers take over
    if (!this.pickupModifierHeld) return;

    const container = this.findContainerAt(e.clientX, e.clientY);
    if (!container) {
      this.removeHighlight();
      this.hovered = null;
      return;
    }
    if (
      this.hovered &&
      this.hovered.from === container.from &&
      this.hovered.to === container.to
    ) {
      return; // unchanged
    }
    this.hovered = container;
    this.showHighlight(container.from, container.to);
  }

  /** While the pickup chord is held, no left mousedown may reach the
   *  editable: Blink-on-macOS performs word-granularity selection for
   *  Option+Shift+click at the mouse-event layer, beneath both PM and
   *  the pointerdown interceptor. */
  private onHostMouseDown(e: MouseEvent): void {
    if (e.button !== 0) return;
    if (!this.pickupModifierHeld) return;
    e.preventDefault();
    e.stopImmediatePropagation();
  }

  private onHostPointerDown(e: PointerEvent): void {
    if (e.button !== 0) return;
    if (!this.pickupModifierHeld) return;

    // Chord held → the click belongs to pickup-drag, never to text
    // selection. Swallow unconditionally (container hit or not) so
    // neither ProseMirror nor the browser's native editing behavior
    // ever sees it. Capture phase + stopImmediate is what makes that
    // reliable — bubble-phase stopPropagation runs too late, after
    // PM's target-phase handler.
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();

    if (dragController.isActive()) return;
    if (!this.hovered || !this.view) return;

    const item: DragItem = {
      from: this.hovered.from,
      to: this.hovered.to,
      id: null,
      type: this.hovered.type,
      level: this.hovered.level,
      label: this.hovered.label,
    };

    // Drag-to-rearrange disabled: the pickup chord stays inert.
    if (!settings.get('dragInteractions')) return;

    this.dragOriginatedHere = true;
    this.removeHighlight();
    this.hovered = null;

    dragController.begin({ view: this.view, items: [item] });
    this.applyPickupClass();
    this.attachDragListeners();
    this.createPickupPill(item);
    this.updatePickupPill(e.clientX, e.clientY);
    dragController.dispatchHit(e.clientX, e.clientY);
  }

  // ---- Drag listeners while a text→nav drag is active ----

  private attachDragListeners(): void {
    if (this.editorPointerMoveAttached) return;
    document.addEventListener('pointermove', this.boundOnDocMove);
    document.addEventListener('pointerup', this.boundOnDocUp);
    this.editorPointerMoveAttached = true;
  }

  private detachDragListeners(): void {
    if (!this.editorPointerMoveAttached) return;
    document.removeEventListener('pointermove', this.boundOnDocMove);
    document.removeEventListener('pointerup', this.boundOnDocUp);
    this.editorPointerMoveAttached = false;
    this.removePickupPill();
  }

  private onDocPointerMoveDuringDrag(e: PointerEvent): void {
    if (!dragController.isActive()) return;
    dragController.setPointer(e.clientX, e.clientY);
    this.updatePickupPill(e.clientX, e.clientY);
    dragController.dispatchHit(e.clientX, e.clientY);
    // Auto-scroll is handled centrally by the drag controller's setPointer.
  }

  private onDocPointerUpDuringDrag(_e: PointerEvent): void {
    if (!dragController.isActive()) return;
    dragController.commit();
    // The 'end' subscriber detaches drag listeners and clears state.
  }

  // ---- Container detection ----

  private findContainerAt(clientX: number, clientY: number): HoveredContainer | null {
    if (!this.view) return null;
    let posInfo: { pos: number; inside: number } | null = null;
    try {
      posInfo = this.view.posAtCoords({ left: clientX, top: clientY });
    } catch {
      return null;
    }
    if (!posInfo) return null;

    const doc = this.view.state.doc;
    const $pos = doc.resolve(Math.min(posInfo.pos, doc.content.size));

    // A point inside a live zone grabs the WHOLE zone as one opaque unit
    // (mirrors computeHeadingRange), so a transcluded card can't be pulled out
    // and the zone moves intact. Checked before the card/heading walk below so
    // the outer zone wins over the inner card.
    // A point inside a live view (`self_ref`) OR a live zone (`transclusion_ref`)
    // grabs the WHOLE unit — its read-only mirrored cards can't be pulled out and
    // it moves intact. Checked before the card/heading walk so the outer unit wins
    // over an inner card.
    for (let depth = $pos.depth; depth >= 1; depth--) {
      const node = $pos.node(depth);
      if (node.type.name === 'transclusion_ref' || isSelfRef(node)) {
        const from = $pos.before(depth);
        const view = isSelfRef(node);
        return {
          from,
          to: from + node.nodeSize,
          type: node.type.name,
          level: 0,
          label: view
            ? String(node.attrs['source_label'] || 'Live view').replace(/^↳\s*/, '')
            : String(node.attrs['source_label'] || this.firstHeadingText(node) || 'Live zone'),
        };
      }
    }

    // Backstop for a pointer over the view's chrome (glyph/rail/padding) where
    // `posAtCoords` may not resolve inside the content: match the `.pmd-self-ref`
    // element under the pointer to its node by DOM identity.
    const domEl = document.elementFromPoint(clientX, clientY) as HTMLElement | null;
    const selfRefEl = domEl?.closest('.pmd-self-ref') ?? null;
    if (selfRefEl) {
      const matches: { pos: number; node: import('prosemirror-model').Node }[] = [];
      const view = this.view;
      doc.descendants((node, pos) => {
        if (matches.length) return false;
        if (isSelfRef(node)) {
          if (view.nodeDOM(pos) === selfRefEl) matches.push({ pos, node });
          return false;
        }
        return true;
      });
      const hit = matches[0];
      if (hit) {
        return {
          from: hit.pos,
          to: hit.pos + hit.node.nodeSize,
          type: 'self_ref',
          level: 0,
          label: String(hit.node.attrs['source_label'] || 'Live view').replace(/^↳\s*/, ''),
        };
      }
    }

    // Walk depths from inner to outer; return the smallest recognized
    // container — a card, an analytic_unit, or a heading paragraph.
    for (let depth = $pos.depth; depth >= 0; depth--) {
      const node = $pos.node(depth);
      const t = node.type.name;

      if (t === 'card' || t === 'analytic_unit') {
        const from = $pos.before(depth);
        return {
          from,
          to: from + node.nodeSize,
          type: t,
          level: 4,
          label: this.firstHeadingText(node),
        };
      }

      if (t === 'pocket' || t === 'hat' || t === 'block') {
        const from = $pos.before(depth);
        const targetLevel = TYPE_TO_LEVEL[t]!;
        // Sibling scan (audit A-49): this runs per POINTERMOVE during a
        // pickup-drag hover, where the old O(rest of doc) nodesBetween
        // saturated the main thread on master files. The zone/self_ref
        // depth check above already returned for zone-inner positions,
        // so this branch only sees flat top-level headings.
        const to = sectionEndFromHeading(
          $pos.node(depth - 1),
          $pos.index(depth - 1),
          from + node.nodeSize,
          targetLevel,
        );
        return {
          from,
          to,
          type: t,
          level: targetLevel,
          label: node.textContent,
        };
      }
    }
    return null;
  }

  private firstHeadingText(node: import('prosemirror-model').Node): string {
    // For card/analytic_unit, the first child is the head (tag/analytic).
    const head = node.firstChild;
    return head ? head.textContent : '';
  }

  // ---- Highlight overlay ----

  private showHighlight(from: number, to: number): void {
    this.removeHighlight();
    if (!this.view || !this.host) return;
    try {
      const fromCoords = this.view.coordsAtPos(from);
      const toCoords = this.view.coordsAtPos(Math.max(from, to - 1));
      const hostRect = this.host.getBoundingClientRect();
      const zoom = this.getEditorZoom();
      const top = (fromCoords.top - hostRect.top) / zoom + this.host.scrollTop;
      const bottom = (toCoords.bottom - hostRect.top) / zoom + this.host.scrollTop;
      const box = document.createElement('div');
      box.className = 'pmd-editor-pickup-highlight';
      box.style.top = `${top}px`;
      box.style.height = `${Math.max(2, bottom - top)}px`;
      this.host.appendChild(box);
      this.highlightBox = box;
    } catch {
      /* skip — coordsAtPos can throw mid-update */
    }
  }

  private getEditorZoom(): number {
    // Read the editor element's EFFECTIVE zoom (single-pane gets it from the
    // window `--editor-zoom` var; each multi-pane editor sets `zoom` inline) —
    // zoom is per-editor, not global, so drag math must use this element's value.
    if (!this.host) return 1;
    const z = parseFloat(getComputedStyle(this.host).getPropertyValue('zoom'));
    return Number.isFinite(z) && z > 0 ? z : 1;
  }

  private removeHighlight(): void {
    if (this.highlightBox) {
      this.highlightBox.remove();
      this.highlightBox = null;
    }
  }

  // ---- Pickup pill (text-side drags get their own pill) ----

  private pickupPill: HTMLElement | null = null;

  private createPickupPill(item: DragItem): void {
    this.removePickupPill();
    const pill = document.createElement('div');
    pill.className = 'pmd-nav-pickup-pill';
    const label = item.label.trim() || `(empty ${item.type})`;
    pill.textContent = label.length > 40 ? label.slice(0, 38) + '…' : label;
    document.body.appendChild(pill);
    this.pickupPill = pill;
  }

  private updatePickupPill(x: number, y: number): void {
    if (!this.pickupPill) return;
    this.pickupPill.style.left = `${x + 12}px`;
    this.pickupPill.style.top = `${y + 12}px`;
  }

  private removePickupPill(): void {
    if (this.pickupPill) {
      this.pickupPill.remove();
      this.pickupPill = null;
    }
  }
}

/**
 * Workspace-wide singleton.
 */
export const editorDragSurface = new EditorDragSurface();

/** Sum `offsetTop` from `el` up to (but excluding) `host`. Returns the
 *  CSS top of `el` inside `host`'s coordinate system, regardless of
 *  intermediate positioned ancestors. Used by drop-indicator placement
 *  to avoid the viewport→host transform that fails when the host
 *  isn't the scroll container. */
function offsetTopWithin(el: HTMLElement, host: HTMLElement): number | null {
  let top = 0;
  let walker: HTMLElement | null = el;
  // 16 hops is a generous bound for editor DOM nesting; prevents
  // accidental infinite walks if `host` somehow isn't in `el`'s
  // offsetParent chain.
  for (let i = 0; i < 16 && walker; i++) {
    if (walker === host) return top;
    top += walker.offsetTop;
    walker = walker.offsetParent as HTMLElement | null;
  }
  return null;
}

