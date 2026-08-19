/**
 * @fileoverview Filterable outline / argument tree — pure data-derivation
 * helpers for idea #10 in TODO.md ("Outline Filters and Argument Tree
 * View"). Given an already-flowed `Flow`, groups its rows (via
 * `flow-transcript-summary`'s `getFlowRowSummaries`) into a tree keyed by
 * the flow's `isHeading` rows — each heading becomes a top-level
 * "contention" node and the non-heading rows beneath it become its
 * children — and lets a caller filter that tree by speech, by side, by
 * unanswered/dropped status, by heading-vs-argument kind, by finer
 * argument-role tag (link/impact/turn/answer/extension, from
 * `Box.argumentType`), by contributor (`Box.authorId`), and by evidence
 * status (`Box.evidenceStatus`). No follow-ups remain open on this idea.
 */

import type { Flow } from "debate-core/src/types/flow";
import { getFlowRowSummaries, type FlowRowSummary } from "./flow-transcript-summary";

export type ArgumentTreeNode = {
  id: string;
  rowIndex: number;
  isHeading: boolean;
  content: string;
  originSpeech: string;
  lastSpeech: string;
  /** Side key derived from `originSpeech` (see `getSpeechSideKey`); `null` for headings. */
  sideKey: string | null;
  isUnanswered: boolean;
  entries: FlowRowSummary["entries"];
  children: ArgumentTreeNode[];
  argumentType?: FlowRowSummary["argumentType"];
  authorId?: FlowRowSummary["authorId"];
  evidenceStatus?: FlowRowSummary["evidenceStatus"];
};

export type ArgumentTreeFilter = {
  /** Matches nodes whose `originSpeech` or `lastSpeech` equals this column name. */
  speech?: string;
  sideKey?: string;
  onlyUnanswered?: boolean;
  /** `"heading"` returns a pure outline of section headers; `"argument"` returns only argument rows (headings are kept only as grouping context when a descendant matches). */
  kind?: "heading" | "argument";
  /** Matches nodes whose `argumentType` equals this value. */
  argumentType?: NonNullable<FlowRowSummary["argumentType"]>;
  /** Matches nodes whose `authorId` equals this value. */
  authorId?: string;
  /** Matches nodes whose `evidenceStatus` equals this value. */
  evidenceStatus?: NonNullable<FlowRowSummary["evidenceStatus"]>;
};

/**
 * Derives a side key from a speech/column name by stripping any leading
 * speech-number digit and taking the first letter after it, e.g.
 * "1AC" -> "A", "2NC" -> "N", "AC" -> "A", "1OC" -> "O", "P1" -> "P".
 * Different debate formats use different column-naming schemes (see
 * `debate-timer`'s format definitions — "A"/"N", "P"/"O", "P"/"C", ...),
 * but every one of them starts each column name with a single
 * side-identifying letter, so this groups columns by side without
 * hardcoding a format-specific meaning like "aff"/"neg" vs "pro"/"con".
 */
export function getSpeechSideKey(speech: string): string | null {
  const match = speech.match(/^\d*([A-Za-z])/);
  return match ? match[1].toUpperCase() : null;
}

/** Every distinct side key present across a flow's columns, in column order. */
export function getFlowSideKeys(flow: Pick<Flow, "columns">): string[] {
  const keys: string[] = [];
  for (const column of flow.columns) {
    const key = getSpeechSideKey(column);
    if (key && !keys.includes(key)) keys.push(key);
  }
  return keys;
}

function toNode(summary: FlowRowSummary): ArgumentTreeNode {
  return {
    id: `row-${summary.rowIndex}`,
    rowIndex: summary.rowIndex,
    isHeading: summary.isHeading,
    content: summary.argument,
    originSpeech: summary.originSpeech,
    lastSpeech: summary.lastSpeech,
    sideKey: summary.isHeading ? null : getSpeechSideKey(summary.originSpeech),
    isUnanswered: summary.isUnanswered,
    entries: summary.entries,
    children: [],
    argumentType: summary.argumentType,
    authorId: summary.authorId,
    evidenceStatus: summary.evidenceStatus,
  };
}

/**
 * Builds a two-level outline tree from a flow: heading rows become
 * top-level nodes, and every non-heading row is nested under the most
 * recent heading above it (mirroring `dataTransform`'s `parentHeadingId`
 * reconstruction). Rows with no flowed content are skipped (same as
 * `getFlowRowSummaries`), and rows that appear before any heading are
 * returned at the top level, in original row order.
 */
export function buildArgumentTree(flow: Pick<Flow, "children" | "columns">): ArgumentTreeNode[] {
  const roots: ArgumentTreeNode[] = [];
  let currentHeading: ArgumentTreeNode | null = null;

  for (const summary of getFlowRowSummaries(flow)) {
    const node = toNode(summary);
    if (node.isHeading) {
      roots.push(node);
      currentHeading = node;
    } else if (currentHeading) {
      currentHeading.children.push(node);
    } else {
      roots.push(node);
    }
  }

  return roots;
}

/**
 * True when a non-heading node matches the given filter. Content filters
 * (`speech`, `sideKey`, `onlyUnanswered`) only ever apply to argument
 * rows — a heading's own row typically carries content in just its first
 * column (the heading label), which would otherwise trip `onlyUnanswered`
 * for every heading regardless of its children, an artifact rather than a
 * meaningful "dropped argument" signal.
 */
function argumentMatches(node: ArgumentTreeNode, filter: ArgumentTreeFilter): boolean {
  if (filter.kind === "heading") return false;
  if (filter.speech && node.originSpeech !== filter.speech && node.lastSpeech !== filter.speech) {
    return false;
  }
  if (filter.sideKey && node.sideKey !== filter.sideKey) return false;
  if (filter.onlyUnanswered && !node.isUnanswered) return false;
  if (filter.argumentType && node.argumentType !== filter.argumentType) return false;
  if (filter.authorId && node.authorId !== filter.authorId) return false;
  if (filter.evidenceStatus && node.evidenceStatus !== filter.evidenceStatus) return false;
  return true;
}

/**
 * Filters an argument tree.
 *
 * - `kind: "argument"` drops every heading wrapper and returns just the
 *   matching argument rows (still grouped under their heading's other
 *   surviving siblings would be redundant, so headings are hoisted away
 *   entirely) — a flat "arguments only" view.
 * - `kind: "heading"` returns a pure outline: headings only, no children.
 * - Otherwise, a heading is kept whenever it has at least one surviving
 *   descendant, so headings act as organizational grouping and aren't
 *   pruned out from under a matching argument just because the heading
 *   row itself carries no matching content.
 *
 * Non-heading nodes are always kept only when they match the filter
 * directly.
 */
export function filterArgumentTree(
  nodes: ArgumentTreeNode[],
  filter: ArgumentTreeFilter,
): ArgumentTreeNode[] {
  const dropHeadingWrappers = filter.kind === "argument";
  const result: ArgumentTreeNode[] = [];

  for (const node of nodes) {
    if (node.isHeading) {
      const children = filterArgumentTree(node.children, filter);
      if (dropHeadingWrappers) {
        result.push(...children);
        continue;
      }
      if (children.length > 0 || filter.kind === "heading") {
        result.push({ ...node, children });
      }
    } else if (argumentMatches(node, filter)) {
      result.push(node);
    }
  }

  return result;
}

/** Flattens a tree back into row order (each heading immediately followed by its children), for rendering a flat filtered list. */
export function flattenArgumentTree(nodes: ArgumentTreeNode[]): ArgumentTreeNode[] {
  const flat: ArgumentTreeNode[] = [];
  for (const node of nodes) {
    flat.push(node);
    if (node.children.length > 0) flat.push(...flattenArgumentTree(node.children));
  }
  return flat;
}
