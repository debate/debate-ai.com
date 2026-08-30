/**
 * @fileoverview Bulk round cloud save — TODO.md idea #17, closing the
 * "No bulk 'save all my rounds' action" Known gap `docs/features/
 * round-cloud-save.md` recorded: each round could only be pushed to the
 * account one at a time via its own cloud icon. Pure flow-collection logic
 * shared by `FlowHistoryDialog`'s "Save all rounds" action, kept
 * framework/fetch-free so it's unit-testable without mocking `fetch`,
 * mirroring `state/savedFlows.ts`/`state/savedRounds.ts`'s split.
 *
 * @module state/bulkRoundSave
 */

import type { Flow, Round } from "../types/flow";

/**
 * Collects the deduplicated set of locally-available flows referenced by
 * any of the given rounds, in first-referencing-round order. Saving a
 * round to the account cascade-saves each flow it references (see
 * `docs/features/round-cloud-save.md`); when saving *every* round in one
 * bulk action, a flow shared by more than one round (or a round that lists
 * the same flow id twice) would otherwise be PUT to `/api/flows` once per
 * round that references it — this collapses that down to exactly one save
 * per flow regardless of how many rounds reference it. A `flowIds` entry
 * with no matching local `Flow` (already-deleted, or never loaded) is
 * silently skipped, same as the per-round save path.
 */
export function collectFlowsForRounds(rounds: Round[], flows: Flow[]): Flow[] {
  const flowsById = new Map(flows.map((flow) => [flow.id, flow]));
  const seen = new Set<number>();
  const result: Flow[] = [];

  for (const round of rounds) {
    for (const flowId of round.flowIds) {
      if (seen.has(flowId)) continue;
      const flow = flowsById.get(flowId);
      if (!flow) continue;
      seen.add(flowId);
      result.push(flow);
    }
  }

  return result;
}

/** Outcome of one round's save within a bulk-save pass, keyed by the round's local `id`. */
export type BulkRoundSaveOutcome = "saved" | "error";

/** Summarizes a bulk-save pass's per-round outcomes into counts for a status message. */
export function summarizeBulkRoundSave(outcomes: Record<number, BulkRoundSaveOutcome>): {
  savedCount: number;
  errorCount: number;
} {
  const values = Object.values(outcomes);
  return {
    savedCount: values.filter((outcome) => outcome === "saved").length,
    errorCount: values.filter((outcome) => outcome === "error").length,
  };
}
