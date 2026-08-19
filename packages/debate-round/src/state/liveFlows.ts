/**
 * @fileoverview Read-only lookup into the live flow editor's own flat `flows`
 * localStorage array (`hooks/useFlowEffects.ts`'s `useInitialLoad`/
 * `useFlowPersistence`) by a stringified `roundId` — the same
 * `String(flow.id)` convention `hooks/useWordCountSpeechMode.ts` already
 * uses. This module never writes to that array; it only resolves a
 * `roundId` back to an already-flowed `Flow`'s `children`/`columns` for
 * `state/memberRoundAssignments.ts`'s coaching-program drill-set
 * composition.
 *
 * @module state/liveFlows
 */

import type { Flow } from "debate-core/src/types/flow";

const STORAGE_KEY = "flows";

function readAllFlows(): Flow[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as Flow[]) : [];
  } catch {
    return [];
  }
}

/**
 * Looks up a live flow by its stringified `id`. Returns `undefined` when
 * `roundId` doesn't resolve to a stored flow (never flowed, or its flow was
 * since deleted) rather than throwing.
 */
export function getLiveFlowByRoundId(roundId: string): Pick<Flow, "children" | "columns"> | undefined {
  return readAllFlows().find((flow) => String(flow.id) === roundId);
}
