/**
 * @fileoverview Tagging a flow row's `argumentType`/`authorId`/`evidenceStatus`
 * — restores idea #10's ("Outline Filters and Argument Tree View" in
 * TODO.md) only write path for these three `Box` fields, after PR #498
 * ("Remove flow spreadsheet grid, show round flows in round editor", merged
 * 2026-09-03) deleted the AG Grid `FlowSpreadsheet` view along with this
 * package's original `argument-tagging.ts`/`ArgumentTagPopover.tsx`/
 * `GridContextMenu.tsx` — the only place in the app that ever set these
 * fields (see `docs/features/argument-tree-outline.md`'s "Known regression"
 * note).
 *
 * That note assumed the AG Grid was replaced by `debate-flow`'s
 * Handsontable-based `HotGrid`/`EbbFlowEmbed` editor, and asked for a
 * "Handsontable-native tagging affordance" there instead of a port of the
 * deleted popover. That premise doesn't hold: `debate-flow` (published as
 * `debate-flow-ebb`) is ebb, an entirely separate local-first flow editor
 * ported in as its own workspace package, mounted in the round page as a
 * self-contained tab — it owns its own `FlowSheet`/`CellMeta` document
 * model and never reads or writes this package's `Box`/`Flow` types at all.
 * Since PR #498, no editor in the live app touches `Flow.children`'s `Box`
 * tree any more (the round page's remaining split view edits
 * `Flow.speechDocs` markdown text instead) — so restoring a tagging
 * affordance to `HotGrid` would tag ebb's own document, which
 * `/outline` never reads, and would silently do nothing for this idea's
 * filters.
 *
 * This module instead restores the pure `Box`-tagging logic — row-level
 * (tags live on the row's *root* `Box`, i.e. `Flow.children[rowIndex]`,
 * the same convention `flow-transcript-summary.ts#summarizeFlowRow` already
 * reads them from) — for a caller to wire up wherever it can reach a live
 * `Flow`. `panels/ArgumentTreePanel.tsx` (`/outline`, in
 * `debate-practice-drills`) is that caller for this slice: it already reads
 * the round workspace's currently selected flow via `debate-round`'s
 * `useFlowStore` for its "Generate outline for current round" action, so a
 * "Tag Argument…" affordance sits naturally alongside it — right where
 * these tags are actually filtered on — rather than requiring a new
 * `Box`-tree grid to be rebuilt first.
 *
 * `setRowsArgumentTags` restores the deleted popover's multi-row bulk
 * tagging, adapted to `ArgumentTreePanel`'s flat row list: a caller collects
 * a set of `rowIndex`es via its own checkbox-selection state (rather than an
 * AG Grid selection model) and applies one set of tags to all of them at
 * once. The deleted popover's *neighbour-preview/bulk-section* mode (tagging
 * every row under a heading in one action) isn't restored — see
 * `docs/features/argument-tree-outline.md`'s "Known gaps" for that narrower
 * remaining follow-up.
 *
 * @module flow/argument-tagging
 */

import type { ArgumentType, Box, EvidenceStatus, Flow } from "../types/flow";

export type ArgumentTags = {
  argumentType?: ArgumentType;
  authorId?: string;
  evidenceStatus?: EvidenceStatus;
};

/** Reads a row's current tags off its root `Box`. Returns an empty object for an out-of-range row. */
export function getRowArgumentTags(flow: Pick<Flow, "children">, rowIndex: number): ArgumentTags {
  const box = flow.children[rowIndex];
  if (!box) return {};
  return {
    argumentType: box.argumentType,
    authorId: box.authorId,
    evidenceStatus: box.evidenceStatus,
  };
}

function taggedBox(box: Box, tags: ArgumentTags): Box {
  const next: Box = { ...box };
  if (tags.argumentType) {
    next.argumentType = tags.argumentType;
  } else {
    delete next.argumentType;
  }
  const authorId = tags.authorId?.trim();
  if (authorId) {
    next.authorId = authorId;
  } else {
    delete next.authorId;
  }
  if (tags.evidenceStatus) {
    next.evidenceStatus = tags.evidenceStatus;
  } else {
    delete next.evidenceStatus;
  }
  return next;
}

/**
 * Returns a new `Flow` with `rowIndex`'s root `Box` retagged. Leaving a
 * field out of `tags` (or passing an empty/whitespace-only `authorId`)
 * removes that tag rather than leaving the row's previous value in place —
 * matching the deleted popover's "choosing None clears the tag" behavior.
 * A no-op (returns `flow` unchanged) for an out-of-range `rowIndex`.
 */
export function setRowArgumentTags<F extends Pick<Flow, "children">>(
  flow: F,
  rowIndex: number,
  tags: ArgumentTags,
): F {
  if (rowIndex < 0 || rowIndex >= flow.children.length) return flow;
  return {
    ...flow,
    children: flow.children.map((box, index) => (index === rowIndex ? taggedBox(box, tags) : box)),
  };
}

/**
 * Bulk variant of `setRowArgumentTags`: applies the same `tags` to every row
 * in `rowIndexes` (a "checkbox-selection" tagging action across multiple
 * rows at once). The same field-clearing rule applies to every targeted row
 * — an omitted field, or a whitespace-only `authorId`, clears that tag
 * everywhere it's applied, not just where it was already set. Duplicate and
 * out-of-range indexes are ignored; a no-op (returns `flow` unchanged) once
 * no valid index remains.
 */
export function setRowsArgumentTags<F extends Pick<Flow, "children">>(
  flow: F,
  rowIndexes: number[],
  tags: ArgumentTags,
): F {
  const targets = new Set(rowIndexes.filter((index) => index >= 0 && index < flow.children.length));
  if (targets.size === 0) return flow;
  return {
    ...flow,
    children: flow.children.map((box, index) => (targets.has(index) ? taggedBox(box, tags) : box)),
  };
}

/** Formats a row's tags as a compact "link · cited · alex" label; empty string when no tag is set. */
export function formatArgumentTags(tags: ArgumentTags): string {
  return [tags.argumentType, tags.evidenceStatus, tags.authorId].filter(Boolean).join(" · ");
}

/** Every distinct `authorId` already used somewhere in the flow, in first-seen row order — contributor-field suggestions so an id stays consistent across rows instead of being retyped each time. */
export function listAuthorIdsInFlow(flow: Pick<Flow, "children">): string[] {
  const authorIds: string[] = [];
  for (const box of flow.children) {
    if (box.authorId && !authorIds.includes(box.authorId)) authorIds.push(box.authorId);
  }
  return authorIds;
}

/**
 * Keyword-rule ordered most-specific-first, so e.g. "this turns their
 * impact" reads as a turn rather than an impact.
 */
const ARGUMENT_TYPE_RULES: [RegExp, ArgumentType][] = [
  [/\bturn(s|ed|ing)?\b/, "turn"],
  [/\bextend(s|ed|ing|s)?\b/, "extension"],
  [/\banswer(s|ed|ing)?\b/, "answer"],
  [/\bimpact(s|ed)?\b/, "impact"],
  [/\blink(s|ed|age)?\b/, "link"],
  [/\bcontention\b/, "contention"],
];

/** Suggests an `argumentType` from a row's own content via a deterministic keyword heuristic; `undefined` if nothing matches. */
export function inferArgumentType(content: string): ArgumentType | undefined {
  const text = content.trim().toLowerCase();
  if (!text) return undefined;
  for (const [pattern, type] of ARGUMENT_TYPE_RULES) {
    if (pattern.test(text)) return type;
  }
  return undefined;
}
