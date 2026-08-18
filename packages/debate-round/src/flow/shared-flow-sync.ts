/**
 * @fileoverview Shared flow sync — pure edit-merge and conflict-detection
 * logic for idea #16 in TODO.md ("Shared, Ai-Generated Debate Flow").
 * While `flow-annotations.ts` lets a single viewer drop timestamped notes
 * on a box, this models what happens when *multiple* teammates flow the
 * same round concurrently: each contributor's proposed edit to a box's
 * content is reconciled into one canonical flow (last write wins per box),
 * while edits that genuinely conflict — different content, from different
 * authors, landing within a short window of each other — are surfaced for
 * a human to resolve instead of being silently overwritten, matching the
 * idea's explicit "keep humans in control of the actual flow and
 * strategic interpretation" requirement. `createFlowEdit` validates and
 * builds one `FlowEdit`, the unit `state/flowEdits.ts` persists. There's
 * still no live transport (e.g. WebSocket) wiring contributors' edits
 * together in real time, and it doesn't preload evidence cards into flow
 * notes yet. See the follow-ups noted in TODO.md.
 */

import type { Box, Flow } from "debate-core/src/types/flow";

/** One contributor's proposed edit to a single box's content. */
export type FlowEdit = {
  id: string;
  flowId: number;
  /** Path from the flow's root children down to the edited box (see `boxFromPath`). */
  boxPath: number[];
  authorId: string;
  content: string;
  timestampMs: number;
};

/** A box's content after merging every edit addressed to it. */
export type MergedBoxEdit = {
  boxPath: number[];
  content: string;
  authorId: string;
  timestampMs: number;
};

/** Two or more edits to the same box that genuinely conflict and need human resolution. */
export type FlowEditConflict = {
  boxPath: number[];
  /** The conflicting edits, oldest first. */
  edits: FlowEdit[];
};

export type MergeFlowEditsResult = {
  merged: MergedBoxEdit[];
  conflicts: FlowEditConflict[];
};

export type MergeFlowEditsOptions = {
  /**
   * Edits to the same box from different authors with different content
   * are only flagged as a conflict when they land within this many
   * milliseconds of the box's latest edit — edits far apart in time are
   * treated as ordinary sequential revisions (last write wins) rather than
   * a concurrent clash.
   */
  conflictWindowMs?: number;
};

const DEFAULT_CONFLICT_WINDOW_MS = 5000;

const MAX_EDIT_CONTENT_LENGTH = 2000;

export type CreateFlowEditInput = {
  id: string;
  flowId: number;
  boxPath: number[];
  authorId: string;
  content: string;
  timestampMs: number;
};

/**
 * Builds a `FlowEdit`, validating that it actually addresses a box
 * (non-empty `boxPath`) and names an author, mirroring
 * `flow-annotations.ts#createFlowAnnotation`'s validation style. `content`
 * is trimmed and clamped to `MAX_EDIT_CONTENT_LENGTH`; an empty, trimmed
 * `content` is valid (it models clearing a box).
 */
export function createFlowEdit(input: CreateFlowEditInput): FlowEdit {
  if (input.boxPath.length === 0) {
    throw new Error("createFlowEdit: boxPath must address a box");
  }
  if (!input.authorId.trim()) {
    throw new Error("createFlowEdit: authorId is required");
  }

  return {
    id: input.id,
    flowId: input.flowId,
    boxPath: input.boxPath,
    authorId: input.authorId.trim(),
    content: input.content.trim().slice(0, MAX_EDIT_CONTENT_LENGTH),
    timestampMs: input.timestampMs,
  };
}

function boxPathKey(boxPath: number[]): string {
  return boxPath.join(".");
}

/** Groups edits by the box they address, preserving each group's relative order. */
export function groupEditsByBox(edits: FlowEdit[]): Map<string, FlowEdit[]> {
  const byBox = new Map<string, FlowEdit[]>();
  for (const edit of edits) {
    const key = boxPathKey(edit.boxPath);
    const group = byBox.get(key);
    if (group) {
      group.push(edit);
    } else {
      byBox.set(key, [edit]);
    }
  }
  return byBox;
}

/**
 * Merges every box's edits into one canonical value (last write wins,
 * ties broken by `id`), except where the box's latest edit and some other,
 * different-author edit with different content landed within
 * `conflictWindowMs` of each other — those boxes are left out of `merged`
 * and reported in `conflicts` instead, since silently picking a winner
 * would erase a teammate's concurrent work.
 */
export function mergeFlowEdits(
  edits: FlowEdit[],
  options: MergeFlowEditsOptions = {},
): MergeFlowEditsResult {
  const conflictWindowMs = options.conflictWindowMs ?? DEFAULT_CONFLICT_WINDOW_MS;
  const merged: MergedBoxEdit[] = [];
  const conflicts: FlowEditConflict[] = [];

  for (const boxEdits of groupEditsByBox(edits).values()) {
    const sorted = [...boxEdits].sort(
      (a, b) => a.timestampMs - b.timestampMs || a.id.localeCompare(b.id),
    );
    const latest = sorted[sorted.length - 1];

    const hasConcurrentDivergence = sorted.some(
      (edit) =>
        edit.authorId !== latest.authorId &&
        edit.content !== latest.content &&
        Math.abs(latest.timestampMs - edit.timestampMs) <= conflictWindowMs,
    );

    if (hasConcurrentDivergence) {
      conflicts.push({ boxPath: latest.boxPath, edits: sorted });
      continue;
    }

    merged.push({
      boxPath: latest.boxPath,
      content: latest.content,
      authorId: latest.authorId,
      timestampMs: latest.timestampMs,
    });
  }

  return { merged, conflicts };
}

function setBoxContentAtPath(boxes: Box[], boxPath: number[], content: string): Box[] {
  const [index, ...rest] = boxPath;
  const target = index === undefined ? undefined : boxes[index];
  if (index === undefined || !target) {
    return boxes;
  }

  const updated: Box =
    rest.length === 0
      ? { ...target, content }
      : { ...target, children: setBoxContentAtPath(target.children, rest, content) };

  return boxes.map((box, i) => (i === index ? updated : box));
}

/**
 * Returns a new `Flow` with every merged edit's content applied to its
 * box, without mutating the input. A merged edit whose `boxPath` no longer
 * resolves to a box (e.g. the flow was restructured after the edit was
 * made) is skipped rather than throwing, mirroring
 * `resolveAnnotationBox`'s no-longer-resolves handling.
 */
export function applyMergedEditsToFlow(flow: Flow, merged: MergedBoxEdit[]): Flow {
  let children = flow.children;
  for (const edit of merged) {
    children = setBoxContentAtPath(children, edit.boxPath, edit.content);
  }
  return { ...flow, children };
}

/** Renders a short summary of a merge for a sync-status banner or notification. */
export function buildSharedFlowSyncSummaryText(result: MergeFlowEditsResult): string {
  const lines: string[] = [];

  lines.push(
    result.merged.length === 0
      ? "No edits to merge."
      : `${result.merged.length} box${result.merged.length === 1 ? "" : "es"} updated.`,
  );

  if (result.conflicts.length > 0) {
    lines.push(
      `${result.conflicts.length} conflict${result.conflicts.length === 1 ? "" : "s"} need${
        result.conflicts.length === 1 ? "s" : ""
      } review:`,
    );
    for (const conflict of result.conflicts) {
      const authors = Array.from(new Set(conflict.edits.map((edit) => edit.authorId)));
      lines.push(`- Box [${conflict.boxPath.join(",")}]: ${authors.join(" vs ")}`);
    }
  }

  return lines.join("\n");
}
