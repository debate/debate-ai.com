/**
 * Live enclosing-container read time — the second segment of the
 * word-count readouts (`liveContainerReadTime`, default on) — and the
 * live remaining read time, the third (`liveRemainingReadTime`,
 * default off).
 *
 * With the cursor parked (no selection), the bars append the read time
 * of the SMALLEST container enclosing it: the card, the analytic unit,
 * or the block section (block heading through the next equal-or-
 * shallower heading — blocks aren't containers in the schema, so that
 * span is resolved positionally, same rule as the nav pane's
 * `computeHeadingRange`). Pocket/hat headings and content outside any
 * of the three deliberately show nothing — the whole-doc readout
 * already covers macro scales.
 *
 * With a selection, the segment shows the selection's time instead —
 * unless `liveSelectionWordCount` is on, in which case the PRIMARY
 * readout already is the selection and the segment is dropped.
 *
 * The remaining segment answers "how much is left to read?" — the
 * read-aloud words from the cursor to the end of the doc, same
 * predicate, same per-reader times. Off by default: it's a speech-prep
 * readout, not something every user wants in the bar.
 *
 * Shared by the single-pane status bar and the three-pane pane footers
 * so the two readouts cannot diverge. Both segments are built to keep
 * a cursor move off the O(doc) path:
 *
 *   - The container count is cached on (doc identity, range): cursor
 *     moves WITHIN a container reuse it, so per-keypress cost is an
 *     ancestor walk, and crossing into a different container costs one
 *     O(container) count — never O(doc).
 *   - The remaining count would be O(doc − cursor) if counted
 *     directly, i.e. O(doc) on every arrow key near the top of a brief.
 *     Instead a SUFFIX-SUM TABLE over the doc's top-level children is
 *     built once per doc — one O(doc) pass, the same cost the whole-doc
 *     readout already pays per doc change — holding, for each child
 *     index `i`, the read-aloud counts of children `i..end`. A cursor
 *     move then costs `$pos.index(0)` (O(depth)) plus one partial count
 *     of just the child the cursor sits in (O(that child)), added to
 *     the table's suffix total for the next child on. Never O(doc).
 *
 * Both caches are one slot keyed on the doc NODE identity, so a stale
 * entry cannot survive a doc change: any transaction that changes the
 * doc produces a new node, and the key misses.
 */

import type { EditorState } from 'prosemirror-state';
import type { Node as PMNode } from 'prosemirror-model';
import { settings } from './settings.js';
import {
  countReadAloudSplit,
  totalWords,
  formatReadTimeFor,
  formatNumber,
  type ReadAloudCounts,
} from './word-count.js';
import { TYPE_TO_LEVEL, sectionEndFromHeading } from './headings.js';

export interface EnclosingContainer {
  label: 'Card' | 'Analytic' | 'Block';
  from: number;
  to: number;
}

/** The smallest card / analytic-unit / block-section enclosing the
 *  selection head, or null (pocket/hat headings, loose doc-level
 *  content, empty doc). Exported for tests. */
export function findEnclosingContainer(state: EditorState): EnclosingContainer | null {
  const $pos = state.selection.$from;

  // Card / analytic unit: the nearest wrapping node wins.
  for (let d = $pos.depth; d >= 1; d--) {
    const node = $pos.node(d);
    if (node.type.name === 'card') {
      const from = $pos.before(d);
      return { label: 'Card', from, to: from + node.nodeSize };
    }
    if (node.type.name === 'analytic_unit') {
      const from = $pos.before(d);
      return { label: 'Analytic', from, to: from + node.nodeSize };
    }
  }

  // No wrapping container: resolve the block SECTION positionally.
  // Scan top-level siblings backwards from the cursor's child for the
  // nearest heading; a cursor inside a heading counts as in its own
  // section. Only a BLOCK heading yields a segment (design call:
  // pocket/hat sections read as "macro" and stay silent).
  const doc = state.doc;
  if (doc.childCount === 0) return null;
  const index = Math.min($pos.index(0), doc.childCount - 1);
  let childPos = 0;
  const positions: number[] = [];
  for (let i = 0; i < doc.childCount; i++) {
    positions.push(childPos);
    childPos += doc.child(i).nodeSize;
  }
  for (let i = index; i >= 0; i--) {
    const child = doc.child(i);
    const level = TYPE_TO_LEVEL[child.type.name];
    if (level === undefined) continue;
    if (child.type.name !== 'block') return null; // pocket/hat: stay silent
    const from = positions[i]!;
    const to = sectionEndFromHeading(doc, i, from + child.nodeSize, level);
    return { label: 'Block', from, to };
  }
  return null;
}

let cache: { doc: PMNode; from: number; to: number; counts: ReadAloudCounts } | null = null;

function countCached(doc: PMNode, from: number, to: number): ReadAloudCounts {
  if (cache && cache.doc === doc && cache.from === from && cache.to === to) {
    return cache.counts;
  }
  const counts = countReadAloudSplit(doc, from, to);
  cache = { doc, from, to, counts };
  return counts;
}

/** The readout tail ("Card: 42 · Amy: 0:31 · Ben: 0:34"), or null when
 *  the feature is off or nothing applies. Callers join it to the
 *  primary readout with " | " — and label their whole-doc side "Doc:"
 *  while this feature is on, so the two sides read symmetrically. */
export function liveContainerSegment(state: EditorState): string | null {
  if (!settings.get('liveContainerReadTime')) return null;
  const sel = state.selection;
  let label: string;
  let counts: ReadAloudCounts;
  if (!sel.empty) {
    // Primary readout already shows the selection when
    // liveSelectionWordCount is on — no duplicate segment.
    if (settings.get('liveSelectionWordCount')) return null;
    label = 'Sel';
    counts = countReadAloudSplit(state.doc, sel.from, sel.to);
  } else {
    const container = findEnclosingContainer(state);
    if (!container) return null;
    label = container.label;
    counts = countCached(state.doc, container.from, container.to);
  }
  return formatSegment(label, counts);
}

/** One segment's text: the labelled word count plus the first two
 *  readers' times, exactly as the primary readout formats its own. */
function formatSegment(label: string, counts: ReadAloudCounts): string {
  const parts = [`${label}: ${formatNumber(totalWords(counts))}`];
  for (const r of settings.get('readers').slice(0, 2)) {
    parts.push(`${r.name}: ${formatReadTimeFor(counts, r)}`);
  }
  return parts.join(' · ');
}

/**
 * Suffix sums of read-aloud counts over the doc's top-level children.
 * `starts[i]` is child `i`'s doc position; `suffix[i]` is the counts of
 * children `i` through the end, so `suffix[0]` is the whole doc and
 * `suffix[childCount]` is zero (the slot that makes "cursor in the last
 * child" need no special case).
 */
interface SuffixTable {
  starts: number[];
  suffix: ReadAloudCounts[];
}

let suffixCache: { doc: PMNode; table: SuffixTable } | null = null;

/** Build (or reuse) the doc's suffix table. Building is one O(doc)
 *  walk; the cache key is the doc node itself, so an edit produces a
 *  new node, misses, and forces the rebuild — a stale table can never
 *  be served for a changed doc. */
function suffixTable(doc: PMNode): SuffixTable {
  if (suffixCache && suffixCache.doc === doc) return suffixCache.table;
  const n = doc.childCount;
  const starts: number[] = new Array(n);
  const suffix: ReadAloudCounts[] = new Array(n + 1);
  const perChild: ReadAloudCounts[] = new Array(n);
  let pos = 0;
  for (let i = 0; i < n; i++) {
    const child = doc.child(i);
    starts[i] = pos;
    // Counted with the CHILD as the root, not a doc-coordinate range:
    // a doc-level `nodesBetween` rescans the preceding siblings to find
    // the window, which would make building the table quadratic in the
    // number of top-level children. The predicate is unaffected — it
    // reads each text node's own parent, which is inside the child.
    perChild[i] = countReadAloudSplit(child);
    pos += child.nodeSize;
  }
  suffix[n] = { body: 0, other: 0 };
  for (let i = n - 1; i >= 0; i--) {
    const next = suffix[i + 1]!;
    const own = perChild[i]!;
    suffix[i] = { body: own.body + next.body, other: own.other + next.other };
  }
  const table = { starts, suffix };
  suffixCache = { doc, table };
  return table;
}

/** Read-aloud counts from `pos` to the end of the doc. O(depth) plus
 *  one count of the single top-level child holding `pos`. */
function countRemaining(doc: PMNode, pos: number): ReadAloudCounts {
  const table = suffixTable(doc);
  const n = doc.childCount;
  // `index(0)` is the number of top-level children entirely before
  // `pos`: inside child i it's i, and at the very end of the doc it's
  // childCount — which lands on the zero slot and short-circuits.
  const i = Math.max(0, Math.min(doc.resolve(pos).index(0), n));
  if (i >= n) return { ...table.suffix[n]! };
  const rest = table.suffix[i + 1]!;
  const child = doc.child(i);
  // Child-relative again (same reason as the build): the child's own
  // content starts one position after the child does, so a doc position
  // `p` inside it sits at `p - start - 1`. A position resting ON the
  // child's boundary — a node selection's end, a gap cursor — is one
  // before that, and clamps to counting the child whole, which is what
  // "nothing of it has been read yet" should mean.
  const rel = Math.max(0, pos - table.starts[i]! - 1);
  const partial = countReadAloudSplit(child, rel, child.content.size);
  return { body: partial.body + rest.body, other: partial.other + rest.other };
}

/** The readout tail for what's still unread ("Left: 1,204 · Amy: 6:31 ·
 *  Ben: 5:44"), or null when the feature is off. Callers join it after
 *  the container segment with " | ". */
export function remainingReadSegment(state: EditorState): string | null {
  if (!settings.get('liveRemainingReadTime')) return null;
  // Measured from `selection.to`, not `from`: the end of a selection is
  // the furthest point the user has accounted for, so a selection reads
  // as "I've gone through this much" and what's left starts after it.
  // With a bare cursor the two coincide.
  return formatSegment('Left', countRemaining(state.doc, state.selection.to));
}
