/**
 * @fileoverview Pure grouping helper for the "History" tab of
 * `FlowHistoryDialog` — the auto-saved undo/version log (`flow-history`,
 * synced to the account via `debate-data-sync`'s `flowHistory` entry in
 * `TOOL_RECORD_COLLECTIONS`). Kept framework-free, mirroring
 * `state/bulkRoundSave.ts`'s split, so the day-grouping logic is
 * unit-testable without rendering the dialog.
 *
 * @module state/flowHistoryGrouping
 */

import type { FlowHistory } from "./store";

/** One calendar day's worth of history entries, newest day first when built from `groupFlowHistoryByDate`. */
export interface FlowHistoryDateGroup {
  dateKey: string;
  entries: FlowHistory[];
}

/**
 * Groups history entries by the calendar day (in the browser's local time
 * zone) they were captured on. `history` is expected newest-first (the
 * store's `saveToHistory` prepends each new entry), so both the groups and
 * each group's entries come out newest-first too — nothing here re-sorts.
 */
export function groupFlowHistoryByDate(history: FlowHistory[]): FlowHistoryDateGroup[] {
  const groups = new Map<string, FlowHistory[]>();

  for (const entry of history) {
    const dateKey = new Date(entry.timestamp).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
    const existing = groups.get(dateKey);
    if (existing) {
      existing.push(entry);
    } else {
      groups.set(dateKey, [entry]);
    }
  }

  return Array.from(groups.entries()).map(([dateKey, entries]) => ({ dateKey, entries }));
}
