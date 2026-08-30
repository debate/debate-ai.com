/**
 * @fileoverview Bulk cloud-save helpers — TODO.md idea #17. Started by
 * closing the "No bulk 'save all my rounds' action" Known gap
 * `docs/features/round-cloud-save.md` recorded (each round could only be
 * pushed to the account one at a time via its own cloud icon), then
 * extended to close that same doc's remaining gap: "a flow with no round
 * referencing it still has no bulk path — only its own per-flow cloud
 * icon." Pure flow-collection logic shared by `FlowHistoryDialog`'s "Save
 * all rounds" and "Save flows not in a round" actions, kept
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

/**
 * Collects every locally-available flow that no round references — the
 * flows "Save all rounds" (via `collectFlowsForRounds`, above) never
 * reaches, since a round only cascade-saves the flows its own `flowIds`
 * lists. Preserves `flows`' own order. A flow id referenced by some round
 * but with no matching local `Flow` doesn't affect the result either way.
 */
export function collectUnreferencedFlows(rounds: Round[], flows: Flow[]): Flow[] {
  const referencedFlowIds = new Set<number>();
  for (const round of rounds) {
    for (const flowId of round.flowIds) {
      referencedFlowIds.add(flowId);
    }
  }

  return flows.filter((flow) => !referencedFlowIds.has(flow.id));
}

/** Outcome of one item's save within a bulk-save pass (a round or a flow), keyed by its local `id`. */
export type BulkSaveOutcome = "saved" | "error";

/** Summarizes a bulk-save pass's per-item outcomes into counts for a status message. */
export function summarizeBulkSaveOutcomes(outcomes: Record<number, BulkSaveOutcome>): {
  savedCount: number;
  errorCount: number;
} {
  const values = Object.values(outcomes);
  return {
    savedCount: values.filter((outcome) => outcome === "saved").length,
    errorCount: values.filter((outcome) => outcome === "error").length,
  };
}
