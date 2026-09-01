/**
 * @fileoverview Pure row-tagging helpers for a flowed argument's
 * `argumentType`/`authorId`/`evidenceStatus` — the "nothing in the live
 * flow-editing UI lets a user actually set a `Box`'s
 * `argumentType`/`authorId`/`evidenceStatus`" gap recorded in
 * `docs/features/argument-tree-outline.md` (follow-up (b) on idea #10,
 * "Outline Filters and Argument Tree View", in TODO.md).
 *
 * `flow-transcript-summary.ts#summarizeFlowRow` reads all three fields from
 * a row's *root* box, so `buildArgumentTree`/`filterArgumentTree` and the
 * Argument Tree Outline panel are row-level throughout — these helpers stay
 * row-level to match, addressing a row by its index in `flow.children`
 * rather than by the per-cell `boxPath` the annotation/edit/prep-note
 * affordances use.
 *
 * `getSectionRowIndexes`/`setRowsArgumentTags`/`getSectionRowPreviews` add a
 * bulk "tag every row in this section" action plus a same-section neighbour
 * preview to `ArgumentTagPopover`, closing the two remaining Known gaps
 * recorded in `docs/features/argument-tree-outline.md`.
 *
 * `getRowPreviewsForIndexes` (the row-summarizing core `getSectionRowPreviews`
 * now delegates to) is also called directly by `FlowSpreadsheet.tsx` to
 * preview an arbitrary multi-row grid selection — not just a row's
 * same-section neighbours — for the "tag every selected row at once" bulk
 * action, closing idea #10's other still-open follow-up ("Multi-select rows
 * to bulk-apply a tag at once") in `TODO.md`.
 */

import type { ArgumentType, Box, EvidenceStatus, Flow } from "../types/flow";

/** The three filterable tags a flowed row can carry, all optional. */
export type ArgumentTags = {
  argumentType?: ArgumentType;
  authorId?: string;
  evidenceStatus?: EvidenceStatus;
};

export const ARGUMENT_TYPES: ArgumentType[] = [
  "contention",
  "link",
  "impact",
  "turn",
  "answer",
  "extension",
];

export const EVIDENCE_STATUSES: EvidenceStatus[] = ["cited", "contested", "unverified"];

/** Reads whichever tags are currently set on the row at `rowIndex`. Unknown rows read as untagged. */
export function getRowArgumentTags(
  flow: Pick<Flow, "children">,
  rowIndex: number,
): ArgumentTags {
  const box = flow.children[rowIndex];
  if (!box) return {};
  return {
    argumentType: box.argumentType,
    authorId: box.authorId,
    evidenceStatus: box.evidenceStatus,
  };
}

/**
 * Applies `tags` to the row at `rowIndex`, returning a new `Flow` (the row's
 * root box is replaced; every other box is shared by reference, mirroring
 * `shared-flow-sync.ts#applyMergedEditsToFlow`). A tag given as `undefined`
 * or an empty/whitespace-only `authorId` is *cleared* rather than left
 * alone, so the popover's "no tag" option round-trips. An out-of-range
 * `rowIndex` returns the flow unchanged.
 */
export function setRowArgumentTags<T extends Pick<Flow, "children">>(
  flow: T,
  rowIndex: number,
  tags: ArgumentTags,
): T {
  return setRowsArgumentTags(flow, [rowIndex], tags);
}

/**
 * Bulk form of {@link setRowArgumentTags} — applies the same `tags` to every
 * row in `rowIndexes` in one pass, returning a single new `Flow`. Duplicate
 * and out-of-range indexes are ignored; if none resolve to a real row, the
 * flow is returned unchanged (by identity, matching the single-row helper).
 * This is what a "tag every row in this section" bulk action calls, with
 * `rowIndexes` typically coming from {@link getSectionRowIndexes}.
 */
export function setRowsArgumentTags<T extends Pick<Flow, "children">>(
  flow: T,
  rowIndexes: number[],
  tags: ArgumentTags,
): T {
  const validIndexes = [...new Set(rowIndexes)].filter((i) => flow.children[i]);
  if (validIndexes.length === 0) return flow;

  const children = [...flow.children];
  for (const rowIndex of validIndexes) {
    children[rowIndex] = buildTaggedBox(children[rowIndex], tags);
  }
  return { ...flow, children };
}

function buildTaggedBox(box: Box, tags: ArgumentTags): Box {
  const tagged: Box = { ...box };
  applyTag(tagged, "argumentType", tags.argumentType);
  applyTag(tagged, "evidenceStatus", tags.evidenceStatus);
  const authorId = tags.authorId?.trim();
  applyTag(tagged, "authorId", authorId ? authorId : undefined);
  return tagged;
}

function applyTag<K extends keyof ArgumentTags>(
  box: Box,
  key: K,
  value: ArgumentTags[K],
): void {
  if (value === undefined) {
    delete box[key];
  } else {
    box[key] = value as never;
  }
}

/**
 * Every content-row index in the same "section" as `rowIndex` — the rows
 * between the nearest heading at or before `rowIndex` (exclusive of the
 * heading itself) and the next heading (exclusive), or the flow's leading
 * rows if none precede it. Mirrors `dataTransform.ts#buildRowData`'s
 * `parentHeadingId` grouping and `argument-tree.ts#buildArgumentTree`'s
 * heading nesting, without needing either the grid's row data or a full
 * tree build. Always includes `rowIndex` itself when it addresses a content
 * row. An out-of-range `rowIndex`, or a heading row directly followed by
 * another heading (an empty section), returns `[]`.
 */
export function getSectionRowIndexes(
  flow: Pick<Flow, "children">,
  rowIndex: number,
): number[] {
  const boxes = flow.children;
  if (rowIndex < 0 || rowIndex >= boxes.length) return [];

  let start = 0;
  if (boxes[rowIndex]?.isHeading) {
    start = rowIndex + 1;
  } else {
    for (let i = rowIndex; i >= 0; i--) {
      if (boxes[i]?.isHeading) {
        start = i + 1;
        break;
      }
    }
  }

  let end = boxes.length;
  for (let i = start; i < boxes.length; i++) {
    if (boxes[i]?.isHeading) {
      end = i;
      break;
    }
  }

  const indexes: number[] = [];
  for (let i = start; i < end; i++) indexes.push(i);
  return indexes;
}

export type SectionRowPreview = {
  rowIndex: number;
  /** The row's own (root-box) content, truncated for a compact list. */
  label: string;
  tags: ArgumentTags;
};

const PREVIEW_LABEL_MAX_LENGTH = 40;

/**
 * Builds a {@link SectionRowPreview} for each of `rowIndexes` (in the order
 * given, after de-duplicating and dropping any index outside `flow.children`)
 * — the shared row-summarizing step behind both {@link getSectionRowPreviews}
 * (a row's same-section neighbours) and the flow grid's multi-row-selection
 * bulk tagging preview (an arbitrary, grid-order set of selected rows), so
 * both previews truncate and format a row's content identically.
 */
export function getRowPreviewsForIndexes(
  flow: Pick<Flow, "children">,
  rowIndexes: number[],
): SectionRowPreview[] {
  return [...new Set(rowIndexes)]
    .filter((i) => flow.children[i])
    .map((i) => {
      const content = flow.children[i]?.content?.trim() ?? "";
      const label =
        content.length > PREVIEW_LABEL_MAX_LENGTH
          ? `${content.slice(0, PREVIEW_LABEL_MAX_LENGTH)}…`
          : content;
      return { rowIndex: i, label, tags: getRowArgumentTags(flow, i) };
    });
}

/**
 * Every *other* content row in `rowIndex`'s section (see
 * {@link getSectionRowIndexes}), each with its own content and current tags
 * — what the tagging popover shows so a contributor can see how
 * neighbouring rows in the section are already tagged before choosing this
 * row's tags, closing the "a row's tags aren't shown in the
 * `ArgumentTagPopover` for the row's neighbours" gap recorded in
 * `docs/features/argument-tree-outline.md`.
 */
export function getSectionRowPreviews(
  flow: Pick<Flow, "children">,
  rowIndex: number,
): SectionRowPreview[] {
  return getRowPreviewsForIndexes(
    flow,
    getSectionRowIndexes(flow, rowIndex).filter((i) => i !== rowIndex),
  );
}

/**
 * Renders a row's tags as one compact label (`"link · cited · alex"`), in a
 * fixed type → status → contributor order so the grid badge and the context
 * menu entry read the same way for every row. Returns `""` for an untagged
 * row, which both call sites treat as "show nothing".
 */
export function formatArgumentTags(tags: ArgumentTags): string {
  const authorId = tags.authorId?.trim();
  return [tags.argumentType, tags.evidenceStatus, authorId ? authorId : undefined]
    .filter((part): part is string => Boolean(part))
    .join(" · ");
}

/**
 * Ordered `argumentType` keyword rules, most-specific first — the first rule
 * whose `keywords` any appear in the (lowercased) content wins. Order matters:
 * "turn" and "extend" are checked before the more generic "link"/"impact"
 * rules so e.g. "this turns their impact" reads as a turn, not an impact.
 */
const ARGUMENT_TYPE_KEYWORD_RULES: { type: ArgumentType; keywords: string[] }[] = [
  { type: "turn", keywords: ["turn", "turns their", "link turn", "impact turn"] },
  {
    type: "extension",
    keywords: ["extend", "extension", "still stands", "goes conceded", "cross-apply", "cross apply"],
  },
  {
    type: "answer",
    keywords: ["no link", "not true", "answer", "responds to", "denies", "they say", "that's wrong"],
  },
  {
    type: "impact",
    keywords: ["impact", "outweighs", "magnitude", "extinction", "timeframe", "probability"],
  },
  { type: "link", keywords: ["link", "internal link", "uniqueness", "leads to"] },
  { type: "contention", keywords: ["contention", "advantage", "off-case", "off case"] },
];

/**
 * Suggests an `argumentType` for a row from its own content via a
 * deterministic keyword heuristic — never called automatically, only offered
 * as a one-click fill-in by `ArgumentTagPopover`, closing the "nothing infers
 * a tag" Known gap recorded in `docs/features/argument-tree-outline.md`.
 * Matching is case-insensitive substring search; the first matching rule in
 * {@link ARGUMENT_TYPE_KEYWORD_RULES} wins. Returns `undefined` for empty
 * content or content matching no rule.
 */
export function inferArgumentType(content: string): ArgumentType | undefined {
  const normalized = content.trim().toLowerCase();
  if (!normalized) return undefined;

  for (const rule of ARGUMENT_TYPE_KEYWORD_RULES) {
    if (rule.keywords.some((keyword) => normalized.includes(keyword))) {
      return rule.type;
    }
  }
  return undefined;
}

/**
 * Every distinct `authorId` already used somewhere in the flow, in
 * first-seen row order — the suggestion list the tagging popover offers so a
 * contributor id stays consistent across rows instead of being retyped (and
 * mistyped) per row.
 */
export function listAuthorIdsInFlow(flow: Pick<Flow, "children">): string[] {
  const authorIds: string[] = [];
  for (const box of flow.children) {
    const authorId = box.authorId?.trim();
    if (authorId && !authorIds.includes(authorId)) authorIds.push(authorId);
  }
  return authorIds;
}
