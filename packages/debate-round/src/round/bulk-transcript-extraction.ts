/**
 * @fileoverview Bulk raw-transcript extraction — idea #6's ("Speech
 * Transcript Summaries and Answers") next-named follow-up: "Bulk transcript
 * upload (multiple speeches at once) instead of one at a time." Pure
 * per-entry outcome tracking shared by `FlowSummariesPanel`'s bulk upload
 * form, kept framework/fetch-free so it's unit-testable without mocking
 * `fetch`, mirroring `state/bulkRoundSave.ts`'s `BulkSaveOutcome`/
 * `summarizeBulkSaveOutcomes` split (and this file's own
 * `transcript-extraction-ai.ts`/`transcript-extraction-client.ts` split,
 * which this module sits directly on top of rather than duplicating).
 *
 * @module round/bulk-transcript-extraction
 */

import type { FlowRowSummary } from "../flow/flow-transcript-summary";
import {
  buildFlowRowSummariesFromExtraction,
  type ExtractedArgument,
  type TranscriptExtractionAiInput,
} from "./transcript-extraction-ai";

/** One speech/transcript pair to extract within a bulk upload batch. */
export type BulkTranscriptEntry = TranscriptExtractionAiInput;

/** Outcome of one entry's extraction within a bulk upload pass, keyed by its index in the submitted list. */
export type BulkTranscriptOutcome = "extracted" | "error";

export interface BulkTranscriptExtractionResult {
  /**
   * Every successfully-extracted row across all entries, in submission
   * order. `rowIndex` continues past `startIndex` across entries — e.g. if
   * entry 0 contributes 3 rows, entry 1's rows start at `startIndex + 3` —
   * so appending the combined list to an existing summary never collides
   * indices, matching the single-entry extraction path's own indexing.
   */
  rows: FlowRowSummary[];
  /** Per-entry outcome, keyed by the entry's index in the submitted `entries` list. */
  outcomes: Record<number, BulkTranscriptOutcome>;
  /** Per-entry error message, present only for entries whose outcome is `"error"`. */
  errors: Record<number, string>;
}

/**
 * Runs `extract` over each of `entries` in turn, accumulating every
 * successfully extracted entry's rows and tracking each entry's outcome
 * independently — one entry's extraction failure doesn't stop the rest from
 * running or being included in the result. Entries are awaited sequentially
 * (not `Promise.all`) because each successful entry's row count must be
 * known before computing the next entry's `rowIndex` offset.
 */
export async function extractTranscriptsBulk(
  entries: BulkTranscriptEntry[],
  startIndex: number,
  extract: (entry: BulkTranscriptEntry) => Promise<ExtractedArgument[]>,
): Promise<BulkTranscriptExtractionResult> {
  const rows: FlowRowSummary[] = [];
  const outcomes: Record<number, BulkTranscriptOutcome> = {};
  const errors: Record<number, string> = {};
  let nextIndex = startIndex;

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    try {
      const extractedArguments = await extract(entry);
      const newRows = buildFlowRowSummariesFromExtraction(entry.speech, extractedArguments, nextIndex);
      rows.push(...newRows);
      nextIndex += newRows.length;
      outcomes[i] = "extracted";
    } catch (e) {
      outcomes[i] = "error";
      errors[i] = e instanceof Error ? e.message : String(e);
    }
  }

  return { rows, outcomes, errors };
}

/** Summarizes a bulk-extraction pass's per-entry outcomes into counts for a status message. */
export function summarizeBulkTranscriptOutcomes(outcomes: Record<number, BulkTranscriptOutcome>): {
  extractedCount: number;
  errorCount: number;
} {
  const values = Object.values(outcomes);
  return {
    extractedCount: values.filter((outcome) => outcome === "extracted").length,
    errorCount: values.filter((outcome) => outcome === "error").length,
  };
}
