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
 */

import type { ArgumentType, Box, EvidenceStatus, Flow } from "debate-core/src/types/flow";

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
  const box = flow.children[rowIndex];
  if (!box) return flow;

  const tagged: Box = { ...box };
  applyTag(tagged, "argumentType", tags.argumentType);
  applyTag(tagged, "evidenceStatus", tags.evidenceStatus);
  const authorId = tags.authorId?.trim();
  applyTag(tagged, "authorId", authorId ? authorId : undefined);

  const children = [...flow.children];
  children[rowIndex] = tagged;
  return { ...flow, children };
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
