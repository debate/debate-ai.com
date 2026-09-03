/**
 * In-document section picker for live views / linked copies — the peek-pattern
 * rebuild (spec: CardMirror-selfref-picker-spec.md, 2026-07-11).
 *
 * ONE `collectHeadings` pass supplies everything: section extents come from
 * position math over the flat entry list (a stack sweep), never from
 * per-heading document walks. The old picker resolved EVERY heading's full
 * section content (`resolveSelfProjection` + `sectionRange`, each of which
 * re-ran `collectHeadings` internally) just to decide eligibility — O(headings
 * × doc) with full Fragment materialization, which took seconds on tournament
 * master files. This filter is O(doc + headings) and allocates nothing but
 * rows.
 *
 * UI: a collapsible leveled outline (disclosure triangles, like the search
 * palette's file peek) with a type-to-filter box and keyboard navigation,
 * in the route-dialog vocabulary. The filter matches the way the palette
 * does — order-independent multi-token substring AND (`matchesAllTokens`),
 * over heading text plus, for tags, the card's cite — not an exact
 * whole-string test, so out-of-order / partial queries land. Rows keep
 * outline order (no relevance ranking — this is a tree, not a result
 * list). Ineligible headings render DISABLED rather
 * than hidden so the hierarchy stays readable (and a disabled pocket can be
 * expanded to reach a pickable block inside it); live-zone innards are
 * omitted entirely (a zone is opaque and never pickable).
 *
 * Two deliberate deltas from the old filter (spec §3.4):
 *  1. The guard interval now includes the heading line, so a cursor ON a
 *     block's heading can no longer pick that block (an immediate cycle).
 *  2. A section whose entire content is dead windows is pickable (the old
 *     full resolution saw through windows; the geometry counts their node
 *     size). Picking one renders an empty window — cycles/missing sources
 *     are caught at render, as before.
 */

import type { EditorView } from 'prosemirror-view';
import type { Node as PMNode } from 'prosemirror-model';
import { collectHeadings, type HeadingEntry } from './headings.js';
import { matchesAllTokens, tokenizeQuery } from './file-search.js';
import { captureFocusForDialog } from './text-prompt.js';
import { pushOverlay, popOverlay, isTopOverlay } from './overlay-stack.js';

interface PickerRow {
  entry: HeadingEntry;
  /** Section extent (guard interval): wrapper start→end for tag/analytic-in-
   *  wrapper; heading start→next-boundary for pocket/hat/block spans. */
  from: number;
  to: number;
  /** Eligible to actually pick (id + text + non-empty + not the guard's own
   *  section). Ineligible rows render disabled, for hierarchy. */
  pickable: boolean;
  /** Lowercased match fields, precomputed once — the filter re-runs over
   *  every row per keystroke. `citeLower` is '' for non-tag rows. */
  textLower: string;
  citeLower: string;
  /** Indexes (into the rows array) of this row's outline ancestors. */
  ancestors: number[];
  hasChildren: boolean;
  collapsed: boolean;
  el: HTMLButtonElement;
  toggleEl: HTMLSpanElement;
}

/** Section geometry for one entry, from the flat entry list — mirrors
 *  computeHeadingRange/extractSection semantics without any doc scans
 *  (spec §3.2). `boundaryTo` must be precomputed for span types. */
function entryGeometry(
  doc: PMNode,
  entry: HeadingEntry,
  boundaryTo: number,
): { from: number; to: number; nonEmpty: boolean } | null {
  const node = doc.nodeAt(entry.pos);
  if (!node) return null;
  const $pos = doc.resolve(entry.pos);
  const parentName = $pos.parent.type.name;
  const isWrapper =
    entry.type === 'tag' ||
    (entry.type === 'analytic' && (parentName === 'analytic_unit' || parentName === 'card'));
  if (isWrapper) {
    const from = $pos.before();
    const wrapper = doc.nodeAt(from);
    if (!wrapper) return null;
    return { from, to: from + wrapper.nodeSize, nonEmpty: true };
  }
  const contentFrom = entry.pos + node.nodeSize;
  return { from: entry.pos, to: boundaryTo, nonEmpty: contentFrom < boundaryTo };
}

/** Next-boundary positions for every entry, in one stack sweep over the flat
 *  list: entry i's span closes at the first later entry with level ≤ its own
 *  (zone-inner entries never terminate an outer section — computeHeadingRange
 *  refuses to descend into `transclusion_ref` for the same reason). */
function computeBoundaries(entries: HeadingEntry[], docSize: number): number[] {
  const to = new Array<number>(entries.length).fill(docSize);
  const stack: number[] = []; // indexes of open spans
  for (let i = 0; i < entries.length; i++) {
    const e = entries[i]!;
    if (e.zonePos !== null) continue; // opaque zone content: not a boundary
    while (stack.length > 0 && entries[stack[stack.length - 1]!]!.level >= e.level) {
      to[stack.pop()!] = e.pos;
    }
    stack.push(i);
  }
  return to;
}

export function openSelfRefPicker(
  view: EditorView,
  opts: { title: string; guardPos: number },
  onPick: (headingId: string) => void,
): void {
  const doc = view.state.doc;
  // The ONE pass. Cites are collected (no skipCite) because the filter
  // matches a tag by its card's cite, like the palette's in-file dive —
  // the same O(doc) walk the nav pane already pays on every refresh.
  const entries = collectHeadings(doc);
  const boundaries = computeBoundaries(entries, doc.content.size);

  // ---- Build the row model (zone innards omitted; everything else shown) ----
  const rows: PickerRow[] = [];
  const ancestorStack: number[] = []; // indexes into rows
  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i]!;
    if (entry.zonePos !== null) continue;
    const geo = entryGeometry(doc, entry, boundaries[i]!);
    if (!geo) continue;
    while (
      ancestorStack.length > 0 &&
      rows[ancestorStack[ancestorStack.length - 1]!]!.entry.level >= entry.level
    ) {
      ancestorStack.pop();
    }
    const inGuardSection = opts.guardPos >= geo.from && opts.guardPos <= geo.to;
    const pickable =
      !!entry.id && !!entry.text.trim() && geo.nonEmpty && !inGuardSection;
    rows.push({
      entry,
      from: geo.from,
      to: geo.to,
      pickable,
      textLower: entry.text.trim().toLowerCase(),
      citeLower: entry.cite?.toLowerCase() ?? '',
      ancestors: [...ancestorStack],
      hasChildren: false, // filled below
      collapsed: false,
      el: null as unknown as HTMLButtonElement,
      toggleEl: null as unknown as HTMLSpanElement,
    });
    ancestorStack.push(rows.length - 1);
  }
  for (let i = 0; i < rows.length - 1; i++) {
    rows[i]!.hasChildren = rows[i + 1]!.entry.level > rows[i]!.entry.level;
  }
  // Large outline → open with blocks collapsed so it reads as a
  // pocket/hat/block outline instead of a wall of tags (spec §4.4).
  if (rows.length > 150) {
    for (const r of rows) if (r.entry.level === 3 && r.hasChildren) r.collapsed = true;
  }

  // ---- Chrome (route-dialog vocabulary; z + scrim from pmd-route-overlay) ----
  const restoreFocus = captureFocusForDialog();
  const overlay = document.createElement('div');
  overlay.className = 'pmd-route-overlay';
  const dialog = document.createElement('div');
  dialog.className = 'pmd-route-dialog pmd-selfref-picker';
  const title = document.createElement('div');
  title.className = 'pmd-route-header';
  title.textContent = opts.title;
  dialog.appendChild(title);

  const filter = document.createElement('input');
  filter.type = 'text';
  filter.className = 'pmd-text-prompt-input pmd-selfref-picker-filter';
  filter.placeholder = 'Filter sections…';
  filter.autocomplete = 'off';
  filter.spellcheck = false;
  dialog.appendChild(filter);

  const list = document.createElement('div');
  list.className = 'pmd-selfref-picker-list';
  dialog.appendChild(list);

  if (rows.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'pmd-selfref-picker-empty';
    empty.textContent = 'No eligible sections in this document.';
    list.appendChild(empty);
  }

  let picked = false;
  const overlayToken = pushOverlay();
  const close = (): void => {
    popOverlay(overlayToken);
    document.removeEventListener('keydown', onKey, true);
    overlay.remove();
    restoreFocus();
  };
  const pick = (row: PickerRow): void => {
    if (picked || !row.pickable || !row.entry.id) return;
    picked = true;
    close();
    onPick(row.entry.id);
    view.focus();
  };

  // ---- Rows (built once; collapse/filter only toggle `hidden`) ----
  let activeIdx = -1; // index into rows; keyboard-driven highlight
  const setActive = (idx: number): void => {
    if (activeIdx >= 0) rows[activeIdx]?.el.classList.remove('pmd-selfref-picker-row-active');
    activeIdx = idx;
    if (idx >= 0) {
      const r = rows[idx]!;
      r.el.classList.add('pmd-selfref-picker-row-active');
      // jsdom has no scrollIntoView; real browsers always do.
      if (typeof r.el.scrollIntoView === 'function') r.el.scrollIntoView({ block: 'nearest' });
    }
  };

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]!;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'pmd-selfref-picker-row';
    btn.style.paddingLeft = `${(row.entry.level - 1) * 14 + 12}px`;
    if (!row.pickable) {
      btn.classList.add('pmd-selfref-picker-row-disabled');
      btn.setAttribute('aria-disabled', 'true');
    }
    if (!row.entry.text.trim()) btn.classList.add('pmd-selfref-picker-row-untitled');

    const toggle = document.createElement('span');
    toggle.className = 'pmd-selfref-picker-toggle';
    toggle.textContent = row.hasChildren ? (row.collapsed ? '▸' : '▾') : '';
    if (row.hasChildren) {
      toggle.addEventListener('click', (e) => {
        e.stopPropagation();
        row.collapsed = !row.collapsed;
        refreshVisibility();
      });
    }
    btn.appendChild(toggle);

    const label = document.createElement('span');
    label.className = 'pmd-selfref-picker-label';
    label.textContent = row.entry.text.trim() || '(untitled)';
    btn.appendChild(label);

    btn.addEventListener('click', () => pick(row));
    row.el = btn;
    row.toggleEl = toggle;
    list.appendChild(btn);
  }

  /** Recompute every row's `hidden` from collapse state + the filter. While a
   *  filter is active, collapse is ignored (matches + ancestors all show) and
   *  the toggles render inert (spec §4.5). O(rows) per call. Matching is the
   *  palette's tokenized AND-match over heading text + tag cite, so inexact /
   *  out-of-order queries land (2026-07-29; was whole-string `includes`). */
  function refreshVisibility(): void {
    const tokens = tokenizeQuery(filter.value);
    if (tokens.length > 0) {
      const visible = new Set<number>();
      for (let i = 0; i < rows.length; i++) {
        if (matchesAllTokens(rows[i]!.textLower, rows[i]!.citeLower, tokens)) {
          visible.add(i);
          for (const a of rows[i]!.ancestors) visible.add(a);
        }
      }
      for (let i = 0; i < rows.length; i++) {
        rows[i]!.el.hidden = !visible.has(i);
        rows[i]!.toggleEl.style.visibility = rows[i]!.hasChildren ? 'hidden' : '';
      }
    } else {
      for (const row of rows) {
        row.el.hidden = row.ancestors.some((a) => rows[a]!.collapsed);
        row.toggleEl.style.visibility = '';
        row.toggleEl.textContent = row.hasChildren ? (row.collapsed ? '▸' : '▾') : '';
      }
    }
    // The active row must stay visible; drop the highlight if it vanished.
    if (activeIdx >= 0 && rows[activeIdx]!.el.hidden) setActive(-1);
  }
  filter.addEventListener('input', refreshVisibility);
  refreshVisibility();

  // ---- Keyboard (capture-phase so it wins while the filter input has focus) --
  const visibleIndexes = (): number[] => {
    const out: number[] = [];
    for (let i = 0; i < rows.length; i++) if (!rows[i]!.el.hidden) out.push(i);
    return out;
  };
  const onKey = (e: KeyboardEvent): void => {
    if (!isTopOverlay(overlayToken)) return;
    if (e.key === 'Escape') {
      e.preventDefault();
      close();
      return;
    }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const vis = visibleIndexes();
      if (vis.length === 0) return;
      const at = vis.indexOf(activeIdx);
      const next =
        e.key === 'ArrowDown'
          ? vis[Math.min(at + 1, vis.length - 1)]!
          : vis[Math.max(at <= 0 ? 0 : at - 1, 0)]!;
      setActive(next);
      return;
    }
    if (e.key === 'ArrowRight') {
      if (activeIdx >= 0 && rows[activeIdx]!.hasChildren && rows[activeIdx]!.collapsed) {
        e.preventDefault();
        rows[activeIdx]!.collapsed = false;
        refreshVisibility();
      }
      return;
    }
    if (e.key === 'ArrowLeft') {
      if (activeIdx < 0) return;
      const row = rows[activeIdx]!;
      if (row.hasChildren && !row.collapsed) {
        e.preventDefault();
        row.collapsed = true;
        refreshVisibility();
      } else if (row.ancestors.length > 0) {
        e.preventDefault();
        setActive(row.ancestors[row.ancestors.length - 1]!);
      }
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      if (activeIdx >= 0) {
        pick(rows[activeIdx]!);
        return;
      }
      const tokens = tokenizeQuery(filter.value);
      if (tokens.length > 0) {
        // First pickable MATCH — ancestors shown for context don't count.
        const first = visibleIndexes().find(
          (i) =>
            rows[i]!.pickable &&
            matchesAllTokens(rows[i]!.textLower, rows[i]!.citeLower, tokens),
        );
        if (first !== undefined) pick(rows[first]!);
      }
    }
  };
  document.addEventListener('keydown', onKey, true);

  const cancel = document.createElement('button');
  cancel.type = 'button';
  cancel.className = 'pmd-route-cancel';
  cancel.textContent = 'Cancel';
  cancel.addEventListener('click', () => close());
  dialog.appendChild(cancel);

  overlay.addEventListener('mousedown', (e) => {
    if (e.target === overlay) close();
  });
  overlay.appendChild(dialog);
  document.body.appendChild(overlay);
  setTimeout(() => filter.focus(), 0);
}
