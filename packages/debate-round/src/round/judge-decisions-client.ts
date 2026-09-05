/**
 * @fileoverview Network calls for the judge-decision-history D1 sync
 * (TODO.md idea #5's "(b) a decision history log per round instead of only
 * the latest result" follow-up). Kept separate from
 * `state/savedJudgeDecisions.ts`'s pure validation helpers so those stay
 * unit-testable without mocking the API client, mirroring
 * `round/word-count-rounds-client.ts`'s split.
 *
 * Talks to `apps/debate-ai.com`'s `/api/judge-decisions` routes (via
 * `debate-api-client`), which require an authenticated session —
 * `listSavedJudgeDecisions` resolves to `null` (rather than throwing) on a
 * `401`, letting the caller (`hooks/useJudgeDecisions.ts`) fall back to
 * local-storage-only history instead of showing an error. The write calls
 * (`saveJudgeDecisionToAccount`, `deleteSavedJudgeDecisionFromAccount`)
 * throw on failure since the caller already has the decision in local
 * state either way — a failed cloud sync is reported but never blocks
 * local saving.
 *
 * @module round/judge-decisions-client
 */

import { deleteJudgeDecision, listJudgeDecisions, syncJudgeDecision, type Client } from "debate-api-client";
import { apiClient, httpStatus } from "../lib/api-client";
import type { JudgeDecisionRecord } from "../state/judgeDecisions";

/** Lists every judge decision synced to the current user's account. Returns `null` when signed out (a `401` response). */
export async function listSavedJudgeDecisions(client: Client = apiClient): Promise<JudgeDecisionRecord[] | null> {
  const { data, error } = await listJudgeDecisions({}, { client });
  if (error) {
    if (httpStatus(error) === 401) return null;
    throw new Error("Failed to load your synced judge decisions.");
  }
  return (data ?? []) as JudgeDecisionRecord[];
}

/** Saves (upserts, keyed by `record.id`) a judge decision to the current user's account. Throws on failure, `401` included. */
export async function saveJudgeDecisionToAccount(
  record: JudgeDecisionRecord,
  client: Client = apiClient,
): Promise<void> {
  const { error } = await syncJudgeDecision({ path: { decisionId: record.id }, body: { record } }, { client });
  if (error) {
    throw new Error("Failed to sync this judge decision to your account.");
  }
}

/** Deletes a synced judge decision from the current user's account. Throws on failure, `401` included. */
export async function deleteSavedJudgeDecisionFromAccount(id: string, client: Client = apiClient): Promise<void> {
  const { error } = await deleteJudgeDecision({ path: { decisionId: id } }, { client });
  if (error) {
    throw new Error("Failed to remove this synced judge decision.");
  }
}
