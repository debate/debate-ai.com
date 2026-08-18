/**
 * @fileoverview Flow-derived transcript summaries — pure data-derivation
 * helpers for idea #6 in TODO.md ("Speech Transcript Summaries and
 * Answers"). Given an already-flowed `Flow` (see debate-core's `Box`/`Flow`
 * types), this module walks each argument thread (row) across the flow's
 * speech columns and derives a concise summary, which arguments currently
 * stand unanswered, and template-based cross-examination/extension prompts
 * built from that. This is the first slice only — it doesn't transcribe
 * audio or use an AI model to extract claims/warrants/impacts from raw
 * speech text; see the follow-ups noted in TODO.md.
 */

import type { Box, Flow } from "debate-core/src/types/flow";

export type FlowRowEntry = {
  /** Column/speech name, e.g. "1AC". */
  speech: string;
  content: string;
};

export type FlowRowSummary = {
  rowIndex: number;
  isHeading: boolean;
  /** The content of the first flowed column: the argument as originally introduced. */
  argument: string;
  /** The speech (column name) the argument was first introduced in. */
  originSpeech: string;
  /** Every non-empty column entry for this row, in column order. */
  entries: FlowRowEntry[];
  /** The speech (column name) of the most recent flowed entry. */
  lastSpeech: string;
  /**
   * True when at least one later column exists past `lastSpeech` and none
   * of them have any flowed content — i.e. as of the flow's current state,
   * nothing has answered or extended this argument since `lastSpeech`.
   */
  isUnanswered: boolean;
};

const MAX_DISPLAY_LENGTH = 160;

function truncateForDisplay(text: string): string {
  const trimmed = text.trim();
  return trimmed.length > MAX_DISPLAY_LENGTH
    ? `${trimmed.slice(0, MAX_DISPLAY_LENGTH).trim()}…`
    : trimmed;
}

/** Flattens one row's box chain into per-column content, following `children[0]` like `dataTransform`'s `buildRowData`. */
function flattenRow(box: Box, columns: string[]): (string | undefined)[] {
  const values: (string | undefined)[] = [];
  let current: Box | undefined = box;
  for (let i = 0; i < columns.length; i++) {
    values.push(current?.content);
    current = current?.children?.[0];
  }
  return values;
}

/**
 * Summarizes a single flow row (one argument thread) across the flow's
 * columns. Returns `null` if the row has no flowed content in any column —
 * there's nothing to summarize.
 */
export function summarizeFlowRow(
  box: Box,
  columns: string[],
  rowIndex: number,
): FlowRowSummary | null {
  const values = flattenRow(box, columns);

  const entries: FlowRowEntry[] = [];
  let lastFilledIndex = -1;
  values.forEach((content, index) => {
    if (content && content.trim()) {
      entries.push({ speech: columns[index], content: content.trim() });
      lastFilledIndex = index;
    }
  });

  if (entries.length === 0) return null;

  const isUnanswered =
    lastFilledIndex < columns.length - 1 &&
    values.slice(lastFilledIndex + 1).every((content) => !content || !content.trim());

  return {
    rowIndex,
    isHeading: box.isHeading ?? false,
    argument: entries[0].content,
    originSpeech: entries[0].speech,
    entries,
    lastSpeech: entries[entries.length - 1].speech,
    isUnanswered,
  };
}

/** Summarizes every row in a flow, skipping rows with no flowed content in any column. */
export function getFlowRowSummaries(flow: Pick<Flow, "children" | "columns">): FlowRowSummary[] {
  const summaries: FlowRowSummary[] = [];
  flow.children.forEach((box, index) => {
    const summary = summarizeFlowRow(box, flow.columns, index);
    if (summary) summaries.push(summary);
  });
  return summaries;
}

/** Non-heading rows whose most recent flowed entry has gone unanswered as of the flow's current state. */
export function getUnansweredFlowRows(flow: Pick<Flow, "children" | "columns">): FlowRowSummary[] {
  return getFlowRowSummaries(flow).filter((row) => row.isUnanswered && !row.isHeading);
}

/**
 * Renders a concise, flow-oriented text summary from already-derived,
 * non-heading rows: one line per argument thread, noting where it was
 * introduced and flagging anything unanswered. Split out from
 * `buildFlowSummaryText` so a panel can render persisted `FlowRowSummary[]`
 * (from `state/flowSummaries.ts`) without needing the original raw `Flow`.
 */
export function buildFlowSummaryTextFromRows(rows: FlowRowSummary[]): string {
  if (rows.length === 0) return "No arguments have been flowed yet.";

  return rows
    .map((row) => {
      const status = row.isUnanswered ? ` (unanswered since ${row.lastSpeech})` : "";
      return `${row.originSpeech}: ${truncateForDisplay(row.argument)}${status}`;
    })
    .join("\n");
}

/**
 * Renders a concise, flow-oriented text summary: one line per argument
 * thread, noting where it was introduced and flagging anything unanswered.
 */
export function buildFlowSummaryText(flow: Pick<Flow, "children" | "columns">): string {
  const rows = getFlowRowSummaries(flow).filter((row) => !row.isHeading);
  return buildFlowSummaryTextFromRows(rows);
}

/** One cross-examination question per unanswered row, referencing where it dropped. */
export function suggestCrossExamQuestions(rows: FlowRowSummary[]): string[] {
  return rows
    .filter((row) => row.isUnanswered)
    .map(
      (row) =>
        `What is your response to "${truncateForDisplay(row.argument)}" (${row.originSpeech})` +
        ` — it hasn't been addressed since ${row.lastSpeech}?`,
    );
}

/** One extension idea per unanswered row, framing it as dropped/conceded. */
export function suggestExtensionIdeas(rows: FlowRowSummary[]): string[] {
  return rows
    .filter((row) => row.isUnanswered)
    .map(
      (row) =>
        `Extend "${truncateForDisplay(row.argument)}" from ${row.originSpeech} as dropped/conceded` +
        ` since ${row.lastSpeech}.`,
    );
}
