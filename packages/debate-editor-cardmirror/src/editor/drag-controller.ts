/**
 * Workspace-scoped drag controller.
 *
 * Coordinates drag-and-drop of headed units within and between the nav
 * pane and editor surfaces — including cross-view drops in multi-pane
 * mode and virtual sources like the dropzone shelf.
 *
 * Architecture: source(s) call `begin(session)` to start a drag.
 * Surfaces register pointer-hit handlers and tell the controller which
 * drop target the cursor is over via `setHoverTarget`. When the pointer
 * is released the active surface calls `commit()`; cancellation goes
 * through `cancel()`. Subscribers listen for state changes to render
 * drag visuals.
 *
 * Same-view drops move (or copy with the modifier held); cross-view
 * and virtual-source drops always copy.
 */

import type { EditorView } from 'prosemirror-view';
import { Selection } from 'prosemirror-state';
import type { EditorState, Transaction } from 'prosemirror-state';
import { Fragment, type Node as PMNode, Slice } from 'prosemirror-model';
import { newHeadingId } from '../schema/ids.js';
import { preciseScrollIntoView } from './precise-scroll.js';
import { READ_MODE_DRAG_META } from './reading-marker.js';
import { autoScrollUnderPointer } from './drag-autoscroll.js';
import { getViewDocPath } from './transclusion-doc-path.js';
import {
  flattenZones,
  fragmentHasZone,
  enclosingZonePos,
  isTransclusionNode,
  isZoneEdited,
  contentHash,
} from './transclusion.js';
import { flattenSelfRefsInSlice, isSelfRef } from './self-transclusion.js';
import { showToast } from './toast.js';

export interface DragItem {
  /** Doc position range covering the dragged unit (heading + its
   *  subtree, or a card/analytic_unit container). Meaningless when
   *  the session is `virtual` and `prebuilt` is set — fill in
   *  zeros in that case. */
  from: number;
  to: number;
  /** Stable heading id, when one exists. */
  id: string | null;
  /** Schema type name (pocket / hat / block / card / analytic_unit).
   *  For virtual sessions (dropzone shelf) this is informational
   *  only — no schema dispatch reads it. */
  type: string;
  /** Outline level (1–4). */
  level: number;
  /** Display label for the pickup pill (the heading's text). */
  label: string;
  /** Pre-built slice for synthetic-source drags (dropzone shelf).
   *  When set, the controller uses this slice directly instead of
   *  slicing from `srcView.state.doc[from..to]`. Used together
   *  with `DragSession.virtual = true`. */
  prebuilt?: Slice;
}

export interface DragSession {
  /** The view the source content lives in. For `virtual` sessions
   *  this points at the currently-focused view (or any view) and
   *  is only used to compare against the drop target — its doc
   *  isn't sliced when items carry `prebuilt`. */
  view: EditorView;
  /** All items being dragged, in document order. */
  items: DragItem[];
  /** True when the session's items come from a virtual source
   *  (the dropzone shelf) rather than a real view region. Drops
   *  always copy in this mode; the source view is never mutated. */
  virtual?: boolean;
}

export interface DropTarget {
  /** The view the drop should land in — the source view for same-view
   *  drops, another pane's view for cross-view drops. */
  view: EditorView;
  /** Document position to insert at, in the target view's current doc. */
  insertPos: number;
  /** Optional shelf-style sink. When present, the controller calls
   *  this with the session items and skips the default insert-into-
   *  view path. Used by surfaces that absorb dragged content into
   *  their own store (the dropzone bubble) rather than land it at
   *  a doc position. */
  absorb?: (items: DragItem[]) => Promise<void> | void;
}

type DragEvent = 'begin' | 'move' | 'end';
type Listener = (event: DragEvent) => void;

/**
 * A drop-target surface (nav pane, editor surface, other panes).
 * Surfaces register at attach time; the controller queries each on
 * every pointermove during a drag and picks the closest hit.
 */
export interface DragSurface {
  /** Test whether the pointer is over a drop slot owned by this
   *  surface. Return null when not. Optionally returns `view` to
   *  signal which editor view the drop should land in — required for
   *  cross-view drops; when omitted the controller defaults to the
   *  source view. */
  hitTest(clientX: number, clientY: number):
    | {
        el: HTMLElement;
        insertPos: number;
        dy: number;
        view?: EditorView;
        absorb?: (items: DragItem[]) => Promise<void> | void;
      }
    | null;
  /** Highlight the given indicator element (or none). The controller
   *  passes the winner across all surfaces; losing surfaces receive
   *  `null` and should clear their highlight. */
  highlight(el: HTMLElement | null): void;
}

class DragControllerImpl {
  private session: DragSession | null = null;
  private hoverTarget: DropTarget | null = null;
  private pointerX = 0;
  private pointerY = 0;
  private copyMode = false;
  private listeners: Set<Listener> = new Set();
  private surfaces: Set<DragSurface> = new Set();

  isActive(): boolean {
    return this.session !== null;
  }

  getSession(): DragSession | null {
    return this.session;
  }

  getHoverTarget(): DropTarget | null {
    return this.hoverTarget;
  }

  getPointer(): { x: number; y: number } {
    return { x: this.pointerX, y: this.pointerY };
  }

  /** Whether the active drag is in "copy" mode (Ctrl on Windows/Linux,
   *  Option on macOS held by the user). Refreshed by the drag source
   *  on pointermove + key events so visuals can track in real time. */
  isCopyMode(): boolean {
    return this.copyMode;
  }

  setCopyMode(copy: boolean): void {
    if (this.copyMode === copy) return;
    this.copyMode = copy;
    this.notify('move');
  }

  begin(session: DragSession): void {
    this.session = session;
    this.hoverTarget = null;
    this.copyMode = false;
    this.notify('begin');
  }

  setPointer(x: number, y: number): void {
    this.pointerX = x;
    this.pointerY = y;
    // Pointer-centric auto-scroll: scroll whatever pane/list is under the
    // pointer (works across panes), once per move from this single chokepoint.
    autoScrollUnderPointer(x, y);
    this.notify('move');
  }

  setHoverTarget(target: DropTarget | null): void {
    if (this.hoverTarget === target) return;
    this.hoverTarget = target;
    this.notify('move');
  }

  /**
   * Apply the drop. Returns true on success, false on no-op (e.g.,
   * drop-on-self). Cancels and returns false if no hover target.
   *
   * `opts.copy` (default false) duplicates the source instead of
   * moving — the original stays in place, a clone with fresh heading
   * IDs lands at the drop target.
   */
  commit(opts: { copy?: boolean } = {}): boolean {
    if (!this.session) return false;
    if (!this.hoverTarget) {
      this.cancel();
      return false;
    }
    const { view: srcView, items } = this.session;
    const { view: tgtView, insertPos } = this.hoverTarget;

    if (items.length === 0) {
      this.cancel();
      return false;
    }

    // Shelf-style drop (dropzone bubble): the target surface
    // absorbs the items into its own store instead of inserting
    // into a view. The controller still tears down the session
    // afterward via the same path as a view-inserting commit.
    if (this.hoverTarget.absorb) {
      void this.hoverTarget.absorb(items);
      this.session = null;
      this.hoverTarget = null;
      this.copyMode = false;
      this.notify('end');
      return true;
    }

    // Cross-view drop OR virtual-source drop (dropzone shelf):
    // always copy. Source content stays put (or doesn't exist as
    // a view location); a clone with fresh heading IDs lands in
    // the target. Virtual sessions use `item.prebuilt` for the
    // slice content; real cross-view sessions slice from the
    // source doc on the fly.
    const isVirtual = !!this.session.virtual;
    if (isVirtual || srcView !== tgtView) {
      const slices = items.map((item) =>
        item.prebuilt ?? srcView.state.doc.slice(item.from, item.to),
      );
      // A live zone is live only in its home doc. Dropping into a DIFFERENT doc
      // (a cross-view drop, or any dropzone/shelf insert — the shelf is a frozen
      // paste) can't trust the zone's doc-relative ref here, so unwrap it to
      // plain content — same rule as a cross-document copy/paste.
      const tgtDoc = getViewDocPath(tgtView);
      const srcDoc = isVirtual ? null : getViewDocPath(srcView);
      const sameDoc = !isVirtual && srcDoc != null && srcDoc === tgtDoc;
      const tr = tgtView.state.tr;
      let target = insertPos;
      for (let slice of slices) {
        // Cross-doc: a Live View can't carry its reference — materialize it to
        // plain cards (real cross-view only; virtual/shelf slices were already
        // materialized when added to the shelf).
        if (!sameDoc && !isVirtual) {
          slice = flattenSelfRefsInSlice(slice, srcView.state.doc, newHeadingId);
        }
        const rewritten = rewriteHeadingIds(slice);
        const content =
          sameDoc || !fragmentHasZone(rewritten.content)
            ? rewritten.content
            : flattenZones(rewritten.content);
        tr.insert(target, content);
        target += content.size;
      }
      // Land the caret on the top of the dropped section, then jump the
      // viewport to it exactly like clicking that heading in the nav pane.
      selectTopOfInsert(tr, insertPos);
      tgtView.dispatch(tr.setMeta(READ_MODE_DRAG_META, true));
      // Move focus to the destination so subsequent edits land here.
      tgtView.focus();
      scrollToDroppedTop(tgtView);
      this.session = null;
      this.hoverTarget = null;
      this.copyMode = false;
      this.notify('end');
      return true;
    }

    // A live zone keeps its content: a plain MOVE may not carry a node OUT of a
    // zone. Reject only when an item's source sits inside a zone and the drop
    // lands elsewhere — that's a card trying to escape. A whole zone (which sits
    // at doc level, so its own source zone is null) moves freely, and dropping
    // OTHER content next to a zone is fine (the zone just shifts as a unit).
    // Copies (modifier held) are deliberate and always allowed.
    if (!opts.copy) {
      const doc = srcView.state.doc;
      const tgtZone = enclosingZonePos(doc, insertPos);
      const escapes = items.some((it) => {
        const srcZone = enclosingZonePos(doc, it.from);
        return srcZone !== null && srcZone !== tgtZone;
      });
      if (escapes) {
        showToast('That would move content out of its live zone.');
        this.cancel();
        return false;
      }
      // Backstop (the drop indicators already avoid offering inner-zone slots):
      // no transclusion UNIT — a linked copy (live zone) OR a live view — can be
      // dropped inside a live zone, or two rails would stack (a nested
      // transclusion updating from a different source).
      const draggingUnit = items.some((it) => {
        const n = doc.nodeAt(it.from);
        return isTransclusionNode(n) || isSelfRef(n);
      });
      if (draggingUnit && tgtZone !== null) {
        showToast('A live view or linked copy can’t go inside a live zone.');
        this.cancel();
        return false;
      }
    }

    const tr = opts.copy
      ? buildCopyTransaction(srcView.state, items, insertPos)
      : buildMoveTransaction(srcView.state, items, insertPos);
    if (!tr) {
      this.cancel();
      return false;
    }
    srcView.dispatch(tr.setMeta(READ_MODE_DRAG_META, true));
    // Focus so PM syncs the DOM caret to the transaction's selection (the
    // front of the dropped heading); without this the visible cursor is
    // left wherever it was before the drag. Then jump the viewport.
    srcView.focus();
    scrollToDroppedTop(srcView);

    this.session = null;
    this.hoverTarget = null;
    this.copyMode = false;
    this.notify('end');
    return true;
  }

  cancel(): void {
    if (!this.session) return;
    this.session = null;
    this.hoverTarget = null;
    this.copyMode = false;
    this.notify('end');
  }

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  registerSurface(surface: DragSurface): () => void {
    this.surfaces.add(surface);
    return () => this.surfaces.delete(surface);
  }

  /**
   * Query every registered surface for a hit, pick the closest, and
   * apply the result: highlight the winner's indicator, clear losing
   * surfaces, set the controller's hover target. Used by drag-source
   * pointermove handlers to keep all surfaces consistent.
   */
  dispatchHit(clientX: number, clientY: number): void {
    if (!this.session) return;
    let winner:
      | {
          surface: DragSurface;
          el: HTMLElement;
          insertPos: number;
          dy: number;
          view?: EditorView;
          absorb?: (items: DragItem[]) => Promise<void> | void;
        }
      | null = null;
    for (const surface of this.surfaces) {
      const hit = surface.hitTest(clientX, clientY);
      if (!hit) continue;
      if (!winner || hit.dy < winner.dy) winner = { ...hit, surface };
    }
    for (const surface of this.surfaces) {
      surface.highlight(winner && winner.surface === surface ? winner.el : null);
    }
    if (winner) {
      // If the winning surface declared its own view (cross-view
      // drops in multi-pane mode), land there; otherwise default to
      // the source view (single-doc behavior).
      this.setHoverTarget({
        view: winner.view ?? this.session.view,
        insertPos: winner.insertPos,
        absorb: winner.absorb,
      });
    } else {
      this.setHoverTarget(null);
    }
  }

  private notify(event: DragEvent): void {
    for (const fn of this.listeners) {
      try {
        fn(event);
      } catch (err) {
        // Don't let one subscriber's error break others.
        console.error('drag listener error', err);
      }
    }
  }
}

/** Workspace-wide singleton. */
export const dragController = new DragControllerImpl();

/**
 * Build a single transaction that cuts the source range(s) and
 * re-inserts them at `insertPos`. Returns null on a no-op (drop on
 * self, or `insertPos` falls inside one of the dragged items'
 * source ranges).
 *
 * Multi-item: items are inserted at the target in their original
 * document order. Cuts happen in reverse-document order so earlier
 * cuts don't shift later sources' positions before we read their
 * content. Slice extraction happens before any deletion to avoid
 * reading from a mutated doc.
 */
export function buildMoveTransaction(
  state: EditorState,
  items: DragItem[],
  insertPos: number,
): Transaction | null {
  items = dedupeRanges(items);
  if (items.length === 0) return null;
  // Reject if target is strictly inside any source range. Boundary
  // positions (= from or = to) are valid drop slots — for multi-item
  // drag, an unmoved sibling's boundary is the natural drop point
  // adjacent to a moved item.
  for (const item of items) {
    if (insertPos > item.from && insertPos < item.to) return null;
  }

  // Capture content before mutating (need original doc positions).
  const ascending = [...items].sort((a, b) => a.from - b.from);
  const slices = ascending.map((item) => state.doc.slice(item.from, item.to));

  // Cut in reverse-document order so earlier-position cuts don't
  // invalidate later items' positions.
  const tr = state.tr;
  const descending = [...items].sort((a, b) => b.from - a.from);
  for (const item of descending) {
    tr.delete(item.from, item.to);
  }

  // Map the target through every cut, then insert items in original
  // document order, advancing the local target by each insertion.
  let target = tr.mapping.map(insertPos);
  const insertStart = target;
  for (const slice of slices) {
    tr.insert(target, slice.content);
    target += slice.content.size;
  }
  // Land the caret (and the post-drop scroll) on the top of the dropped
  // section — its first heading — so the viewport follows the move.
  selectTopOfInsert(tr, insertStart);
  return tr;
}

/** Collapse items sharing an identical [from,to] range down to one. A nav
 *  multi-select of several headings INSIDE the same live zone promotes each
 *  of them to the same whole-zone range (`zoneRangeForEntry`) — without the
 *  dedup, the move path would delete that range once per duplicate, eating
 *  whatever content slid into the range after the first cut. */
function dedupeRanges(items: DragItem[]): DragItem[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = `${item.from}:${item.to}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** Put the selection at the top of just-inserted content (`insertStart`
 *  is the position right before the first inserted node) so the drop's
 *  `scrollIntoView` lands on the dropped section's first header. */
function selectTopOfInsert(tr: Transaction, insertStart: number): void {
  try {
    tr.setSelection(Selection.near(tr.doc.resolve(insertStart), 1));
  } catch {
    // Position out of range (defensive) — leave the default selection.
  }
}

/** Jump the viewport to the just-dropped content exactly as the nav
 *  pane's "jump to heading" does: resolve the DOM element at the current
 *  selection (the drop transaction left the caret at the top of the
 *  dropped section) and `preciseScrollIntoView` it to the top of the
 *  viewport. This re-measures + converges (handling `content-visibility:
 *  auto` undershoot), unlike PM's `tr.scrollIntoView()` which only
 *  guarantees the caret lands somewhere on screen. Must run after the
 *  drop transaction has been dispatched (DOM updated). */
function scrollToDroppedTop(view: EditorView): void {
  try {
    const at = view.domAtPos(view.state.selection.from);
    let node: Node | null = at.node;
    while (node && node.nodeType !== Node.ELEMENT_NODE) node = node.parentNode;
    if (node instanceof HTMLElement) preciseScrollIntoView(view, node);
  } catch {
    // Stale position (defensive) — skip the scroll.
  }
}

/**
 * Build a single transaction that duplicates the source range(s) and
 * inserts the clone(s) at `insertPos`. The original stays in place.
 * Heading IDs in the cloned subtree are rewritten with fresh values
 * via `rewriteHeadingIds` so the workspace's id-uniqueness invariant
 * (per ARCHITECTURE §4 / §12) holds after the duplicate lands. Used
 * by the nav-pane copy-drag (Ctrl on Windows/Linux, Option on macOS).
 *
 * Returns null on a no-op (`insertPos` strictly inside a source range
 * — "copy into self"). Boundary positions (= from or = to) are valid
 * drop slots, the same predicate as the move path.
 */
export function buildCopyTransaction(
  state: EditorState,
  items: DragItem[],
  insertPos: number,
): Transaction | null {
  items = dedupeRanges(items);
  if (items.length === 0) return null;
  for (const item of items) {
    if (insertPos > item.from && insertPos < item.to) return null;
  }

  const ascending = [...items].sort((a, b) => a.from - b.from);
  const slices = ascending.map((item) =>
    rewriteHeadingIds(state.doc.slice(item.from, item.to)),
  );

  const tr = state.tr;
  let target = insertPos;
  for (const slice of slices) {
    tr.insert(target, slice.content);
    target += slice.content.size;
  }
  selectTopOfInsert(tr, insertPos);
  return tr;
}

/** Walk a slice and replace every non-null `attrs.id` with a fresh
 *  `newHeadingId()`. Only nodes whose schema declares an `id` attr
 *  populated with a string get rewritten (pocket / hat / block / tag /
 *  analytic — see `headingAttrs` in `schema/nodes.ts`). Nodes without
 *  an id attr or with a default-null id pass through unchanged. Used for
 *  duplicating live-doc content (drag-copy / dropzone / send-to-speech),
 *  where every heading already carries an id. */
export function rewriteHeadingIds(slice: Slice): Slice {
  return mapSliceIds(slice, (node) =>
    !!(node.attrs && typeof node.attrs['id'] === 'string' && node.attrs['id']),
  );
}

/** Assign a fresh `newHeadingId()` to EVERY id-bearing node, regardless
 *  of its current value (including the default `null`). Used by paste:
 *  PM's clipboard parser drops `data-id` (our `parseDOM.getAttrs` only
 *  reads `indent`), so pasted pockets/hats/blocks/tags arrive with
 *  `id: null` — and the nav pane keys expand/collapse, jump, and the
 *  1/2/3/4 level filter off the id, so id-less headings are inert.
 *  Filling ids on paste keeps the workspace id-uniqueness invariant
 *  (ARCHITECTURE §4 / §12) the same way the copy paths do. */
export function freshHeadingIds(slice: Slice): Slice {
  return mapSliceIds(slice, (node) => !!node.attrs && 'id' in node.attrs);
}

function mapSliceIds(slice: Slice, assign: (node: PMNode) => boolean): Slice {
  return new Slice(mapFragmentIds(slice.content, assign), slice.openStart, slice.openEnd);
}

function mapFragmentIds(frag: Fragment, assign: (node: PMNode) => boolean): Fragment {
  const children: PMNode[] = [];
  frag.forEach((child) => children.push(mapNodeIds(child, assign)));
  return Fragment.fromArray(children);
}

function mapNodeIds(node: PMNode, assign: (node: PMNode) => boolean): PMNode {
  // Text nodes are immutable and can't be reconstructed via
  // `type.create` — and they never carry an id attr anyway, so leave
  // them alone. Inline leaves (image) likewise have no id.
  if (node.isText) return node;
  // A live zone's edit-baseline (`source_content_hash`) is id-DEPENDENT, but the
  // id rewrite below changes the ids inside it — so without re-baselining, a
  // copied/pasted UNEDITED zone would read as edited (broken-link glyph). Capture
  // its edited state BEFORE the rewrite; re-stamp only if it was unedited (an
  // already-edited zone keeps its old baseline and stays edited).
  const restampZone = isTransclusionNode(node) && !isZoneEdited(node);
  const newContent = node.isLeaf ? node.content : mapFragmentIds(node.content, assign);
  let nextAttrs = assign(node) ? { ...node.attrs, id: newHeadingId() } : node.attrs;
  if (restampZone) {
    nextAttrs = { ...nextAttrs, source_content_hash: contentHash(newContent) };
  }
  return node.type.create(nextAttrs, newContent, node.marks);
}
