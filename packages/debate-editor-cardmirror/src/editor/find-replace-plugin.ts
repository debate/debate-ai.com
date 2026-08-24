/**
 * Find / Replace — search across the doc's plain text, highlight every
 * hit with a yellow band decoration, and let the caller step through
 * matches, replace the current one, or replace all.
 *
 * State the plugin owns:
 *   - `query`, `caseSensitive`, `wholeWord` — the active search
 *     parameters. Empty query == "search inactive" == no matches.
 *   - `matches` — doc-position ranges of every hit in the current
 *     doc.
 *   - `currentIndex` — index into `matches` of the "active" match
 *     (the one navigation lands on, the one Replace acts on). -1
 *     when no matches.
 *
 * Meta actions (set via `tr.setMeta(findReplaceKey, {...})`):
 *   - `{ type: 'setQuery', query, caseSensitive, wholeWord }` — set
 *     the search parameters and rescan. `currentIndex` resets to 0
 *     when there are matches, -1 otherwise.
 *   - `{ type: 'navigate', dir: 1 | -1 }` — bump `currentIndex` in
 *     the given direction, wrapping around the ends.
 *   - `{ type: 'setCurrentIndex', index }` — set the active index
 *     explicitly (used by Replace after a replacement is dispatched
 *     so the next match becomes active without a separate navigate).
 *   - `{ type: 'clear' }` — reset to inactive state.
 *
 * Doc changes (transactions where `tr.docChanged`) trigger a rescan
 * iff the query is non-empty. The rescan is incremental: existing
 * matches are mapped through the transaction and only the top-level
 * children the change touched are re-scanned (full O(doc) rescan is
 * reserved for cap/scope edge cases — see
 * `rescanIncrementalAfterDocChange`). `currentIndex` is clamped to the
 * new `matches.length` so the active hit never points past the end.
 *
 * Replace logic lives in the `runReplace` / `runReplaceAll` Commands
 * exported below — the plugin only owns query state and decorations;
 * the actual text edit is a separate transaction the caller dispatches.
 */

import {
  Plugin,
  PluginKey,
  TextSelection,
  type Command,
  type EditorState,
  type Transaction,
} from 'prosemirror-state';
import { Decoration, DecorationSet } from 'prosemirror-view';
import type { Node as PMNode } from 'prosemirror-model';
import { changedRange, expandToTopLevel } from './decoration-range.js';
import { preciseScrollIntoView } from './precise-scroll.js';
import { isWordChar, normalizeForMatch } from './word-break.js';

/** Match category, derived from the containing textblock's node type
 *  at scan time. Used by the `categorized` sort mode to bubble
 *  structurally-significant matches to the top of the result list. */
export type FindCategory = 'heading' | 'tag' | 'analytic' | 'undertag' | 'cite' | 'other';

/** Sort modes the plugin supports. Both traverse top-to-bottom starting
 *  at the cursor and wrapping to the top of the document:
 *   - `categorized` (Ctrl-F): order by category priority (see
 *     `categoryOrder`), then document-order-from-cursor within each
 *     category.
 *   - `uncategorized` (Alt-F): document-order-from-cursor across the
 *     whole match set; categories ignored.
 */
export type FindSortMode = 'categorized' | 'uncategorized';

export interface FindMatch {
  from: number;
  to: number;
  category: FindCategory;
  /** Within-category sub-rank. Lower is higher priority. Currently
   *  only used for the cite category: matches whose inline content
   *  carries the `cite_mark` (the citation style) rank above
   *  matches that just happen to live in a `cite_paragraph`
   *  without the mark. For other categories this is always 0. */
  subcategory: number;
}

export interface FindReplaceState {
  query: string;
  caseSensitive: boolean;
  wholeWord: boolean;
  /** Cursor anchor — the wrap point for document-order-from-cursor
   *  ordering. Captured once at `setQuery` time so navigating through
   *  matches doesn't shuffle the order. Set to -1 when there's no
   *  active query. */
  anchor: number;
  sortMode: FindSortMode;
  /** Category priority used by `categorized` sort. Lower index ==
   *  higher priority. Ignored when sortMode is `uncategorized`. */
  categoryOrder: FindCategory[];
  /** When set, matches are restricted to this range. Captured from
   *  the editor selection at the moment the user activates the
   *  scope toggle, and mapped through every subsequent doc-changing
   *  transaction so it tracks edits. Null = search the whole doc. */
  scope: { from: number; to: number } | null;
  matches: FindMatch[];
  currentIndex: number;
}

type Meta =
  | {
      type: 'setQuery';
      query: string;
      caseSensitive: boolean;
      wholeWord: boolean;
      anchor: number;
      sortMode: FindSortMode;
      categoryOrder: FindCategory[];
    }
  | { type: 'navigate'; dir: 1 | -1 }
  | { type: 'setCurrentIndex'; index: number }
  | { type: 'setScope'; scope: { from: number; to: number } | null }
  | { type: 'clear' };

const DEFAULT_CATEGORY_ORDER: FindCategory[] = [
  'heading',
  'tag',
  'analytic',
  'undertag',
  'cite',
  'other',
];

export const findReplaceKey = new PluginKey<FindReplaceState>('find-replace');

// Whole-word toggle classifies each char via the project-wide
// word-break iterator (`./word-break.ts`) — letters (incl. non-
// ASCII), digits, `'` U+0027, `'` U+2019. Differs from regex
// `\w`: underscore `_` is NOT a word character under the spec,
// and neither is `.` / `,` / hyphen / dash / `'` U+2018. So e.g.
// searching "don" whole-word doesn't match inside "don't"
// (apostrophe joins the word), while "user" matches "user_name"
// (underscore breaks). The `word-break.ts` header documents the
// full model.

/** Map a textblock node type name to its match category. The
 *  three doc-level outline heading types collapse to `heading`;
 *  card-anchor `tag`, standalone `analytic`, `undertag`, and
 *  `cite_paragraph` each get their own category; everything else
 *  (card_body, paragraph, table_cell, ...) is `other`. */
function categoryForTextblockType(name: string): FindCategory {
  if (name === 'pocket' || name === 'hat' || name === 'block') return 'heading';
  if (name === 'tag') return 'tag';
  if (name === 'analytic') return 'analytic';
  if (name === 'undertag') return 'undertag';
  if (name === 'cite_paragraph') return 'cite';
  return 'other';
}

/** True iff ANY inline node in `[from, to)` carries the
 *  `cite_mark` (the named-style applied to cited text). Used to
 *  bubble partially-cite-marked hits above non-marked ones within
 *  the cite category. */
function rangeHasCiteMark(doc: PMNode, from: number, to: number): boolean {
  const citeMarkType = doc.type.schema.marks['cite_mark'];
  if (!citeMarkType) return false;
  let found = false;
  doc.nodesBetween(from, to, (node) => {
    if (found) return false;
    if (!node.isInline) return true;
    if (citeMarkType.isInSet(node.marks)) found = true;
    return !found;
  });
  return found;
}

/** Hard cap on matches collected per search — bounds the work and the decoration
 *  set on a pathological query (a common short term in a huge doc), which could
 *  otherwise choke the renderer. Generous enough that real searches never hit it;
 *  the UI shows `N+` when reached. */
export const FIND_MATCH_CAP = 10000;

/** Scan the doc for every hit of `query`. Walks the plain
 *  `textBetween` representation of each textblock — matches that
 *  span textblock boundaries are intentionally not supported (Word
 *  + VS Code behave the same way for paragraph-spanning text).
 *  When `scope` is non-null, hits outside `[scope.from, scope.to]`
 *  are filtered out (a hit must lie ENTIRELY within the scope —
 *  partial overlaps at the boundary are dropped).
 *  Returns matches in document order (sorting layered on top by
 *  the caller). */
function findMatches(
  state: EditorState,
  query: string,
  caseSensitive: boolean,
  wholeWord: boolean,
  scope: { from: number; to: number } | null,
  /** When set, scan only the textblocks overlapping this range instead
   *  of the whole doc. Must be expanded to top-level-child boundaries
   *  (see `expandToTopLevel`) so no textblock is half-covered. Used by
   *  the incremental doc-change rescan. */
  range: { from: number; to: number } | null = null,
): FindMatch[] {
  if (!query) return [];
  const out: FindMatch[] = [];
  // Normalize curly quotes, dashes, and ellipses so e.g. a straight-quote /
  // hyphen / "..." query matches Word's smart quotes / en–em dashes / "…", and
  // vice versa. The `.map` returned alongside translates normalized offsets back
  // to real ones (only the "..."→"…" collapse changes length).
  const needleNorm = normalizeForMatch(caseSensitive ? query : query.toLowerCase()).text;
  const visit = (node: PMNode, pos: number): boolean => {
    if (out.length >= FIND_MATCH_CAP) return false; // stop collecting past the cap
    if (!node.isTextblock) return true;
    // NOT textContent: inline atoms (images) have nodeSize 1 but
    // contribute nothing to textContent, so every character offset
    // after one would lag its document position — misaligned
    // decorations and Replace eating the wrong range. A one-char leaf
    // placeholder keeps offsets ≡ positions, and U+0000 can never
    // occur in a query, so a match can't span an image.
    const text = node.textBetween(0, node.content.size, undefined, '\u0000');
    if (!text) return false;
    const category = categoryForTextblockType(node.type.name);
    const { text: hay, map } = normalizeForMatch(caseSensitive ? text : text.toLowerCase());
    let searchFrom = 0;
    while (searchFrom <= hay.length - needleNorm.length) {
      const idx = hay.indexOf(needleNorm, searchFrom);
      if (idx < 0) break;
      // `idx` is a NORMALIZED offset; map both ends back to real character
      // offsets (these differ only where a "..." collapsed to one char).
      const origFrom = map[idx]!;
      const origTo = map[idx + needleNorm.length]!;
      if (wholeWord) {
        const before = origFrom > 0 ? text[origFrom - 1]! : '';
        const after = origTo < text.length ? text[origTo]! : '';
        if (isWordChar(before) || isWordChar(after)) {
          searchFrom = idx + 1;
          continue;
        }
      }
      // `pos` is the position of the textblock node itself; `pos + 1`
      // is the start of its inline content. `origFrom`/`origTo` are
      // character offsets into that content — which (with the placeholder
      // trick) equal the inline character offsets / doc positions.
      const matchFrom = pos + 1 + origFrom;
      const matchTo = pos + 1 + origTo;
      // Apply scope filter (if any) before producing the match.
      // Partial overlap at the boundary is dropped — keeps the
      // "search within selection" mental model clean.
      if (scope && (matchFrom < scope.from || matchTo > scope.to)) {
        searchFrom = idx + needleNorm.length;
        continue;
      }
      // Cite-category matches get a sub-rank: cite-marked text
      // (the citation style applied as an inline mark) outranks
      // text that just happens to live inside a cite_paragraph.
      // Partial overlap counts — even one cite-marked character
      // inside the match is enough.
      let subcategory = 0;
      if (category === 'cite') {
        subcategory = rangeHasCiteMark(state.doc, matchFrom, matchTo) ? 0 : 1;
      }
      out.push({
        from: matchFrom,
        to: matchTo,
        category,
        subcategory,
      });
      if (out.length >= FIND_MATCH_CAP) break;
      searchFrom = idx + needleNorm.length;
    }
    // Don't descend into the textblock's inline content — we already
    // consumed its `textContent`.
    return false;
  };
  if (range) state.doc.nodesBetween(range.from, range.to, visit);
  else state.doc.descendants(visit);
  return out;
}

/** Document-order-from-cursor comparator: matches at/after the anchor
 *  come first, then matches before it — each side in ascending document
 *  position. So traversal runs top-to-bottom starting at the cursor and
 *  wraps to the top of the document (the first Next lands on the match
 *  at/after the cursor, then continues downward, then wraps). NOT
 *  proximity — a far-below match still precedes a just-above one. */
function compareFromCursor(
  a: FindMatch,
  b: FindMatch,
  anchor: number,
): number {
  const aAfter = a.from >= anchor;
  const bAfter = b.from >= anchor;
  if (aAfter !== bAfter) return aAfter ? -1 : 1;
  return a.from - b.from;
}

/** Apply the chosen sort mode in place. Both modes walk top-to-bottom
 *  from the cursor (wrapping). Categorized: by category index in
 *  `order` first, then document-order-from-cursor within each category.
 *  Uncategorized: document-order-from-cursor across the whole match set. */
function sortMatches(
  matches: FindMatch[],
  sortMode: FindSortMode,
  anchor: number,
  order: FindCategory[],
): void {
  if (sortMode === 'uncategorized') {
    matches.sort((a, b) => compareFromCursor(a, b, anchor));
    return;
  }
  // Look up category priority once per match (small set, but cheap
  // to memoize anyway).
  const prio: Record<FindCategory, number> = {
    heading: order.indexOf('heading'),
    tag: order.indexOf('tag'),
    analytic: order.indexOf('analytic'),
    undertag: order.indexOf('undertag'),
    cite: order.indexOf('cite'),
    other: order.indexOf('other'),
  };
  // Any category absent from a user-mangled order falls back to
  // last position so it's still searchable.
  for (const k of ['heading', 'tag', 'analytic', 'undertag', 'cite', 'other'] as FindCategory[]) {
    if (prio[k] < 0) prio[k] = order.length;
  }
  matches.sort((a, b) => {
    const cmp = prio[a.category] - prio[b.category];
    if (cmp !== 0) return cmp;
    // Within a category, sub-rank wins before document order. Today the
    // only category with a non-zero sub-rank is `cite` (cite-marked
    // vs. just-in-cite-paragraph).
    const sub = a.subcategory - b.subcategory;
    if (sub !== 0) return sub;
    return compareFromCursor(a, b, anchor);
  });
}

/** Recompute matches for the new doc when the query is non-empty.
 *  Sorts via the saved `sortMode` + `anchor` + `categoryOrder` so
 *  doc edits don't shuffle the ranking the user is navigating.
 *  `currentIndex` is preserved if the current match still exists in
 *  the new match set (matched by from-position); otherwise it's
 *  clamped to the nearest valid index, or -1 if there are no
 *  matches. */
function rescanAfterDocChange(
  state: EditorState,
  prev: FindReplaceState,
): FindReplaceState {
  if (!prev.query) {
    return { ...prev, matches: [], currentIndex: -1 };
  }
  const matches = findMatches(
    state,
    prev.query,
    prev.caseSensitive,
    prev.wholeWord,
    prev.scope,
  );
  if (matches.length === 0) return { ...prev, matches, currentIndex: -1 };
  sortMatches(matches, prev.sortMode, prev.anchor, prev.categoryOrder);
  // Try to keep the active index pointing at "the same match" by
  // looking up the previous match's from-position in the new list.
  let nextIndex = 0;
  if (prev.currentIndex >= 0 && prev.matches[prev.currentIndex]) {
    const prevFrom = prev.matches[prev.currentIndex]!.from;
    const found = matches.findIndex((m) => m.from === prevFrom);
    nextIndex = found >= 0 ? found : Math.min(prev.currentIndex, matches.length - 1);
  }
  return { ...prev, matches, currentIndex: nextIndex };
}

/** Incremental `rescanAfterDocChange`: map the existing matches
 *  through the transaction (cheap) and re-scan only the top-level
 *  children the change touched, so typing with an active query costs
 *  O(edited card) instead of O(doc). Falls back to the full rescan
 *  whenever the incremental result could differ from a full scan:
 *  no computable changed range (defensive), or the match list at /
 *  reaching FIND_MATCH_CAP (which hits survive the cap depends on
 *  whole-doc scan order). Invariant: the produced match SET is always
 *  identical to what `rescanAfterDocChange` would produce. */
function rescanIncrementalAfterDocChange(
  state: EditorState,
  prev: FindReplaceState,
  tr: Transaction,
): FindReplaceState {
  if (!prev.query) {
    return { ...prev, matches: [], currentIndex: -1 };
  }
  if (prev.matches.length >= FIND_MATCH_CAP) {
    return rescanAfterDocChange(state, prev);
  }
  const changed = changedRange(tr);
  if (!changed) return rescanAfterDocChange(state, prev);
  const zone = expandToTopLevel(state.doc, changed.from, changed.to);

  // Matches outside the changed zone can only MOVE: they live in
  // untouched textblocks (matches never span textblocks, and
  // `changedRange` covers mark-only steps too), so mapping their
  // positions is exact. Anything overlapping the zone is dropped here
  // and re-found by the range scan below if it still exists.
  const kept: FindMatch[] = [];
  for (const m of prev.matches) {
    const fromResult = tr.mapping.mapResult(m.from, 1);
    if (fromResult.deleted) continue;
    const from = fromResult.pos;
    const to = tr.mapping.map(m.to, -1);
    if (to <= from) continue;
    if (from < zone.to && to > zone.from) continue;
    kept.push(from === m.from && to === m.to ? m : { ...m, from, to });
  }
  const fresh = findMatches(
    state,
    prev.query,
    prev.caseSensitive,
    prev.wholeWord,
    prev.scope,
    zone,
  );
  if (kept.length + fresh.length >= FIND_MATCH_CAP) {
    return rescanAfterDocChange(state, prev);
  }
  const matches = kept.concat(fresh);
  if (matches.length === 0) return { ...prev, matches, currentIndex: -1 };
  sortMatches(matches, prev.sortMode, prev.anchor, prev.categoryOrder);
  // Preserve the active match across the edit by its mapped position
  // (same contract as rescanAfterDocChange, made exact by the mapping:
  // the full-rescan variant can only re-find position-stable hits).
  let nextIndex = 0;
  if (prev.currentIndex >= 0 && prev.matches[prev.currentIndex]) {
    const mappedFrom = tr.mapping.map(prev.matches[prev.currentIndex]!.from, 1);
    const found = matches.findIndex((m) => m.from === mappedFrom);
    nextIndex = found >= 0 ? found : Math.min(prev.currentIndex, matches.length - 1);
  }
  return { ...prev, matches, currentIndex: nextIndex };
}

export function findReplacePlugin(): Plugin<FindReplaceState> {
  // Per-instance memo of the BASE decoration set — the scope band + every match
  // with the base class. Keyed on (doc, matches, scope) but NOT currentIndex, so
  // navigating between results doesn't rebuild all N highlights: the current-match
  // emphasis is layered on as a single overlay (see `decorations`). ProseMirror
  // calls `decorations` on every view update; `apply` returns the SAME state
  // object when nothing relevant changed, so the reference-identity check is cheap.
  let baseCache: {
    doc: unknown;
    matches: unknown;
    scope: unknown;
    set: DecorationSet;
  } | null = null;
  return new Plugin<FindReplaceState>({
    key: findReplaceKey,
    state: {
      init: (): FindReplaceState => ({
        query: '',
        caseSensitive: false,
        wholeWord: false,
        anchor: -1,
        sortMode: 'categorized',
        categoryOrder: DEFAULT_CATEGORY_ORDER.slice(),
        scope: null,
        matches: [],
        currentIndex: -1,
      }),
      apply(tr, prev, _oldState, newState): FindReplaceState {
        const meta = tr.getMeta(findReplaceKey) as Meta | undefined;
        if (meta?.type === 'clear') {
          return {
            query: '',
            caseSensitive: prev.caseSensitive,
            wholeWord: prev.wholeWord,
            anchor: -1,
            sortMode: prev.sortMode,
            categoryOrder: prev.categoryOrder,
            scope: null,
            matches: [],
            currentIndex: -1,
          };
        }
        if (meta?.type === 'setQuery') {
          const matches = findMatches(
            newState,
            meta.query,
            meta.caseSensitive,
            meta.wholeWord,
            prev.scope,
          );
          sortMatches(matches, meta.sortMode, meta.anchor, meta.categoryOrder);
          return {
            query: meta.query,
            caseSensitive: meta.caseSensitive,
            wholeWord: meta.wholeWord,
            anchor: meta.anchor,
            sortMode: meta.sortMode,
            categoryOrder: meta.categoryOrder,
            scope: prev.scope,
            matches,
            currentIndex: matches.length > 0 ? 0 : -1,
          };
        }
        // First: if the doc changed, map the existing scope through
        // the transaction's mapping so it tracks edits. Then run the
        // rescan (which depends on the up-to-date scope).
        let scope = prev.scope;
        let scopeCollapsed = false;
        if (tr.docChanged && scope) {
          const fromMapped = tr.mapping.map(scope.from);
          const toMapped = tr.mapping.map(scope.to);
          // Drop the scope entirely if it's been collapsed to a
          // point or inverted by the mapping — the user's "search
          // within this range" intent is no longer meaningful.
          if (fromMapped < toMapped) {
            scope = { from: fromMapped, to: toMapped };
          } else {
            scope = null;
            scopeCollapsed = true;
          }
        }
        // Doc-change rescan runs BEFORE the rest of the meta dispatch
        // so navigate / setCurrentIndex operate on the up-to-date
        // match list. Without this, a transaction that both changes
        // the doc AND sets a meta (e.g., `runReplace`) would leave
        // `matches` stale.
        let next = scope === prev.scope ? prev : { ...prev, scope };
        if (tr.docChanged && next.query) {
          // A collapsed scope widens the searchable region from the
          // old scope band to the whole doc, so matches far from the
          // edit can appear; only the full rescan sees those.
          next = scopeCollapsed
            ? rescanAfterDocChange(newState, next)
            : rescanIncrementalAfterDocChange(newState, next, tr);
        }
        if (meta?.type === 'setScope') {
          const newMatches = next.query
            ? findMatches(
                newState,
                next.query,
                next.caseSensitive,
                next.wholeWord,
                meta.scope,
              )
            : [];
          if (next.query) {
            sortMatches(newMatches, next.sortMode, next.anchor, next.categoryOrder);
          }
          return {
            ...next,
            scope: meta.scope,
            matches: newMatches,
            currentIndex: newMatches.length > 0 ? 0 : -1,
          };
        }
        if (meta?.type === 'navigate') {
          if (next.matches.length === 0) return next;
          const n = next.matches.length;
          const cur = next.currentIndex < 0 ? 0 : next.currentIndex;
          const newIdx = (cur + meta.dir + n) % n;
          return { ...next, currentIndex: newIdx };
        }
        if (meta?.type === 'setCurrentIndex') {
          if (next.matches.length === 0) return next;
          const clamped = Math.max(
            0,
            Math.min(meta.index, next.matches.length - 1),
          );
          return { ...next, currentIndex: clamped };
        }
        return next;
      },
    },
    props: {
      decorations(state) {
        const s = findReplaceKey.getState(state);
        if (!s) return null;
        if (s.matches.length === 0 && !s.scope) return null;
        // Rebuild the BASE set only when the search (doc / matches / scope)
        // changes — never on navigation. Navigation just moves the single
        // current-match overlay below, so stepping through results is O(log N)
        // rather than an O(N) rebuild of every highlight.
        if (
          !baseCache ||
          baseCache.doc !== state.doc ||
          baseCache.matches !== s.matches ||
          baseCache.scope !== s.scope
        ) {
          const decos: Decoration[] = [];
          if (s.scope) {
            // Faint band showing where "search within selection" applies; sits
            // underneath the match decorations.
            decos.push(Decoration.inline(s.scope.from, s.scope.to, { class: 'pmd-find-scope' }));
          }
          for (const m of s.matches) {
            decos.push(Decoration.inline(m.from, m.to, { class: 'pmd-find-match' }));
          }
          baseCache = {
            doc: state.doc,
            matches: s.matches,
            scope: s.scope,
            set: decos.length === 0 ? DecorationSet.empty : DecorationSet.create(state.doc, decos),
          };
        }
        // Layer the current match's emphasis on top of the cached base as a
        // single decoration — its class merges onto the base `pmd-find-match`
        // span. Cheap (`.add` of one), so this runs per render without a memo.
        const cur = s.currentIndex >= 0 ? s.matches[s.currentIndex] : null;
        if (!cur) return baseCache.set;
        return baseCache.set.add(state.doc, [
          Decoration.inline(cur.from, cur.to, { class: 'pmd-find-match-current' }),
        ]);
      },
    },
  });
}

/** Replace the currently-active match with `replacement` and advance
 *  to the next match (so a "find → replace → find → replace" cadence
 *  works without re-pressing the navigate button between every
 *  pair). Returns false when there's no active match to replace. */
export function runReplace(replacement: string): Command {
  return (state, dispatch) => {
    const s = findReplaceKey.getState(state);
    if (!s) return false;
    if (s.currentIndex < 0 || !s.matches[s.currentIndex]) return false;
    if (!dispatch) return true;
    const match = s.matches[s.currentIndex]!;
    const tr = state.tr;
    if (replacement) {
      tr.insertText(replacement, match.from, match.to);
    } else {
      tr.delete(match.from, match.to);
    }
    // Hold the current index so the rescan-after-doc-change handler's
    // "match still at this from-position?" check picks the NEXT match
    // (the one just past the replaced range) as the new active hit.
    // Without this, replacement → currentIndex would jump back to 0.
    tr.setMeta(findReplaceKey, {
      type: 'setCurrentIndex',
      index: s.currentIndex,
    });
    dispatch(tr);
    return true;
  };
}

/** Replace every match in one pass.
 *
 *  Must iterate from the END of the doc to the START so earlier
 *  replacements don't shift later positions and corrupt them.
 *  `s.matches` is sorted for display (categorized / uncategorized),
 *  NOT in doc order, so re-sort by doc position here before
 *  iterating — reversing the display order is not equivalent. */
export function runReplaceAll(replacement: string): Command {
  return (state, dispatch) => {
    const s = findReplaceKey.getState(state);
    if (!s || s.matches.length === 0) return false;
    if (!dispatch) return true;
    const byDocPosDesc = s.matches.slice().sort((a, b) => b.from - a.from);
    const tr = state.tr;
    for (const m of byDocPosDesc) {
      if (replacement) {
        tr.insertText(replacement, m.from, m.to);
      } else {
        tr.delete(m.from, m.to);
      }
    }
    dispatch(tr);
    return true;
  };
}

/** Move the editor selection (and viewport) to the currently-active
 *  match. Called by the UI on every navigate / open-bar action so
 *  the user can see what's about to be replaced.
 *
 *  Selection update happens via a transaction (so subsequent
 *  Replace knows which run is active). The actual scroll is an
 *  explicit DOM `scrollIntoView` on the element containing the
 *  match — PM's `tr.scrollIntoView()` only scrolls when the
 *  editor's view has focus, which it doesn't while the user is
 *  driving the floating find bar. The DOM-level call works
 *  regardless of focus and picks up the closest scrolling
 *  ancestor (window in single-doc, the pane container in
 *  multi-doc) automatically. */
export function scrollToCurrentMatch(view: import('prosemirror-view').EditorView): void {
  const s = findReplaceKey.getState(view.state);
  if (!s || s.currentIndex < 0 || !s.matches[s.currentIndex]) return;
  const m = s.matches[s.currentIndex]!;
  const tr = view.state.tr.setSelection(
    TextSelection.create(view.state.doc, m.from, m.to),
  );
  view.dispatch(tr);
  try {
    const domAtPos = view.domAtPos(m.from);
    let target: Element | null = domAtPos.node as Element | null;
    if (target && target.nodeType === Node.TEXT_NODE) {
      target = (target as unknown as Text).parentElement;
    }
    if (target instanceof HTMLElement) {
      // cv:auto-aware scroll: force-materialize all cards / headings
      // so the alignment math is computed against real heights, then
      // let cv:auto resume once the scroll has stabilized. See
      // `precise-scroll.ts` for the rationale.
      preciseScrollIntoView(view, target, 'center');
    }
  } catch {
    // domAtPos can throw if the position isn't materialized yet
    // (content-visibility: auto cards). Fall back to PM's path —
    // if the editor is focused, this scrolls; if not, the user
    // can navigate again once the placeholder materializes.
    view.dispatch(
      view.state.tr
        .setSelection(TextSelection.create(view.state.doc, m.from, m.to))
        .scrollIntoView(),
    );
  }
}
