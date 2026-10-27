/**
 * @fileoverview Counts the words a side flowed in a `Flow`, so the Log-a-round
 * form can fill "Words spoken" from a saved flow instead of manual entry
 * (follow-up to the `speechLength` stat in `round/debater-stats.ts`).
 *
 * Words are counted per column entry that `getFlowRowSummaries` returns, so a
 * flow's heading rows count too. The side for a `"aff"`/`"neg"` log entry is
 * the first/second distinct side key in column order (e.g. `A`/`N` for
 * `1AC, 1NC, …`), matching `getFlowSideKeys`.
 */

import type { Flow } from "../types/flow";
import { getFlowSideKeys, getSpeechSideKey } from "./argument-tree";
import { getFlowRowSummaries } from "./flow-transcript-summary";

/** Words in a string, split on whitespace. */
export function countWords(text: string): number {
  const trimmed = text.trim();
  return trimmed === "" ? 0 : trimmed.split(/\s+/).length;
}

/** The flow's side key for a logged side, or `null` when the flow has no such side. */
export function sideKeyForLoggedSide(
  flow: Pick<Flow, "columns">,
  side: "aff" | "neg",
): string | null {
  return getFlowSideKeys(flow)[side === "aff" ? 0 : 1] ?? null;
}

/**
 * Total words flowed in the columns belonging to the given logged side.
 * Returns `null` when the flow has no column for that side, so callers can
 * tell "no data" from "zero words".
 */
export function countFlowWordsForSide(
  flow: Pick<Flow, "children" | "columns">,
  side: "aff" | "neg",
): number | null {
  const sideKey = sideKeyForLoggedSide(flow, side);
  if (sideKey === null) return null;
  let total = 0;
  for (const summary of getFlowRowSummaries(flow)) {
    for (const entry of summary.entries) {
      if (getSpeechSideKey(entry.speech) === sideKey) total += countWords(entry.content);
    }
  }
  return total;
}
