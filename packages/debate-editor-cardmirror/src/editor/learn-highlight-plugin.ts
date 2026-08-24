/**
 * Flashcard highlight plugin (SPEC-learn-system §4.2).
 *
 * Renders the in-document highlight for each *resolved* flashcard anchor
 * as a view-only inline **decoration** — never a mark. This is the load-
 * bearing choice: decorations are never part of `doc.toJSON()` or the
 * export pipeline, so a flashcard's grounding can never leak into a
 * shared `.cmir` / `.docx` (unlike a `comment_range` mark, which would
 * need stripping at every serialize site). The local annotation layer
 * stays strictly local by construction.
 *
 * The plugin holds the resolved ranges and maps them through edits:
 * a range that collapses (its whole span deleted) is dropped, so the
 * comments column can move that card to its Unanchored list. Resolution
 * itself (descriptor → positions) happens in the comments column when it
 * opens; this plugin just tracks + paints what it's handed.
 */

import { Plugin, PluginKey } from 'prosemirror-state';
import type { EditorState, Transaction } from 'prosemirror-state';
import { Decoration, DecorationSet } from 'prosemirror-view';

export interface FlashcardRange {
  cardId: string;
  from: number;
  to: number;
  /** Which annotation kind this range belongs to — picks the highlight
   *  color (accent for flashcards, purple for AI threads, green for
   *  notes). Defaults to flashcard when absent. */
  kind?: 'flashcard' | 'ai' | 'note';
}

interface Range {
  from: number;
  to: number;
}

interface HighlightState {
  ranges: FlashcardRange[];
  /** The annotation (comment OR flashcard) whose card is active in the
   *  column — emphasized in the doc so you can see which one is selected.
   *  Null when nothing is active. */
  active: Range | null;
  /** Monotonic count of flashcard ranges that collapsed under an edit
   *  (a whole-span delete, or — crucially — a card *move*, which PM
   *  position-mapping can't follow). The column watches this and
   *  re-resolves from the stored descriptors to re-ground moved cards. */
  dropCount: number;
  decos: DecorationSet;
}

export const learnHighlightKey = new PluginKey<HighlightState>('learn-highlight');

type Meta =
  | { type: 'set'; ranges: FlashcardRange[] }
  | { type: 'upsert'; range: FlashcardRange }
  | { type: 'remove'; cardId: string }
  | { type: 'active'; active: Range | null };

function buildDecos(
  doc: EditorState['doc'],
  ranges: FlashcardRange[],
  active: Range | null,
): DecorationSet {
  const decos = ranges
    .filter((r) => r.to > r.from)
    .map((r) =>
      Decoration.inline(r.from, r.to, {
        class:
          r.kind === 'ai'
            ? 'pmd-ai-range'
            : r.kind === 'note'
            ? 'pmd-note-range'
            : 'pmd-flashcard-range',
        'data-card-id': r.cardId,
      }),
    );
  // Active-annotation emphasis sits ON TOP (added last) of any flashcard
  // highlight; works for plain comments too (they have no flashcard deco).
  if (active && active.to > active.from) {
    decos.push(Decoration.inline(active.from, active.to, { class: 'pmd-annotation-active' }));
  }
  return DecorationSet.create(doc, decos);
}

/** Map a range through an edit, dropping it if its span collapsed. */
function mapRange(r: Range, tr: Transaction): Range | null {
  const from = tr.mapping.map(r.from, 1);
  const to = tr.mapping.map(r.to, -1);
  return to > from ? { from, to } : null;
}

export const learnHighlightPlugin = new Plugin<HighlightState>({
  key: learnHighlightKey,
  state: {
    init() {
      return { ranges: [], active: null, dropCount: 0, decos: DecorationSet.empty };
    },
    apply(tr, prev, _old, newState) {
      const meta = tr.getMeta(learnHighlightKey) as Meta | undefined;
      if (meta?.type === 'set') {
        const ranges = meta.ranges.filter((r) => r.to > r.from).map((r) => ({ ...r }));
        return { ...prev, ranges, decos: buildDecos(newState.doc, ranges, prev.active) };
      }
      if (meta?.type === 'upsert') {
        // Add or replace a single range by cardId, leaving others (and
        // their live-mapped positions) untouched. Used when an annotation
        // is created / re-grounded at a KNOWN position — no doc walk.
        const others = prev.ranges.filter((r) => r.cardId !== meta.range.cardId);
        const ranges =
          meta.range.to > meta.range.from ? [...others, { ...meta.range }] : others;
        return { ...prev, ranges, decos: buildDecos(newState.doc, ranges, prev.active) };
      }
      if (meta?.type === 'remove') {
        const ranges = prev.ranges.filter((r) => r.cardId !== meta.cardId);
        return { ...prev, ranges, decos: buildDecos(newState.doc, ranges, prev.active) };
      }
      if (meta?.type === 'active') {
        return { ...prev, active: meta.active, decos: buildDecos(newState.doc, prev.ranges, meta.active) };
      }
      if (!tr.docChanged) return prev;
      // Track edits: bias from→right, to→left so edits at the exact
      // boundary stay outside the span (matches comment_range's
      // inclusive:false), and a fully-deleted span collapses and is
      // dropped.
      const mapped: FlashcardRange[] = [];
      let dropped = 0;
      for (const r of prev.ranges) {
        const m = mapRange(r, tr);
        if (m) mapped.push({ cardId: r.cardId, from: m.from, to: m.to, kind: r.kind });
        else dropped += 1;
      }
      const active = prev.active ? mapRange(prev.active, tr) : null;
      return {
        ranges: mapped,
        active,
        dropCount: prev.dropCount + dropped,
        decos: buildDecos(newState.doc, mapped, active),
      };
    },
  },
  props: {
    decorations(state) {
      return learnHighlightKey.getState(state)?.decos ?? null;
    },
  },
});

/** Currently-resolved flashcard ranges (after live edit tracking). */
export function flashcardRanges(state: EditorState): FlashcardRange[] {
  return learnHighlightKey.getState(state)?.ranges ?? [];
}

/** The resolved annotation range containing `pos` (both ends inclusive),
 *  or null. First match wins when ranges abut/overlap. Lets the cursor-
 *  activation path focus the column card for AI / flashcard text — which
 *  anchors via these decorations, not a `comment_range` mark — the same
 *  way a comment focuses its thread. */
export function flashcardRangeAt(state: EditorState, pos: number): FlashcardRange | null {
  for (const r of flashcardRanges(state)) {
    if (pos >= r.from && pos <= r.to) return r;
  }
  return null;
}

/** Map of cardId → live range, for the column's positioning. */
export function flashcardRangeMap(state: EditorState): Map<string, { from: number; to: number }> {
  const out = new Map<string, { from: number; to: number }>();
  for (const r of flashcardRanges(state)) out.set(r.cardId, { from: r.from, to: r.to });
  return out;
}

/** Monotonic count of flashcard ranges collapsed by edits (move/delete).
 *  The column re-resolves when this advances, recovering moved cards. */
export function flashcardDropCount(state: EditorState): number {
  return learnHighlightKey.getState(state)?.dropCount ?? 0;
}

/** Replace the resolved-anchor set (called after re-resolution). The
 *  transaction is doc-neutral + out of undo history. */
export function setFlashcardRangesTr(
  state: EditorState,
  ranges: FlashcardRange[],
): Transaction {
  return state.tr.setMeta(learnHighlightKey, { type: 'set', ranges }).setMeta('addToHistory', false);
}

/** Add or replace ONE resolved range by cardId, from a known position —
 *  the create / re-ground fast path that skips descriptor resolution.
 *  Doc-neutral + out of undo history. */
export function upsertFlashcardRangeTr(
  state: EditorState,
  range: FlashcardRange,
): Transaction {
  return state.tr.setMeta(learnHighlightKey, { type: 'upsert', range }).setMeta('addToHistory', false);
}

/** Emphasize the active annotation's range in the doc (or clear it with
 *  null). Doc-neutral + out of undo history. */
export function setActiveAnnotationRangeTr(
  state: EditorState,
  active: { from: number; to: number } | null,
): Transaction {
  return state.tr.setMeta(learnHighlightKey, { type: 'active', active }).setMeta('addToHistory', false);
}
