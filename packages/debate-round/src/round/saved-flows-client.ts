/**
 * @fileoverview Network calls for the flow cloud save D1 sync (TODO.md idea
 * #17, follow-up (3), "flows" half). Kept separate from
 * `state/savedFlows.ts`'s pure validation/derivation helpers so those stay
 * unit-testable without mocking the API client, mirroring
 * `round/user-settings-client.ts`'s split.
 *
 * Talks to `apps/debate-ai.com`'s `/api/flows` routes (via `debate-api-client`),
 * which require an authenticated session — the read calls (`listSavedFlows`,
 * `fetchSavedFlow`) resolve to `null` (rather than throwing) on a `401`,
 * letting the caller fall back to "sign in to sync" UI instead of showing
 * an error. The write calls (`saveFlowToAccount`, `deleteSavedFlow`) throw
 * on failure since the caller already has the flow in local state either
 * way — a failed cloud sync is reported but never blocks local editing.
 *
 * @module round/saved-flows-client
 */

import { deleteFlow, getFlow, listFlows, syncFlow, type Client } from "debate-api-client";
import { apiClient, httpStatus } from "../lib/api-client";
import type { Flow } from "../types/flow";
import type { SavedFlowSummary } from "../state/savedFlows";

/** Lists the current user's saved flows (summaries only). Returns `null` when signed out (a `401` response). */
export async function listSavedFlows(client: Client = apiClient): Promise<SavedFlowSummary[] | null> {
  const { data, error } = await listFlows({}, { client });
  if (error) {
    if (httpStatus(error) === 401) return null;
    throw new Error("Failed to load your saved flows.");
  }
  return (data ?? []) as SavedFlowSummary[];
}

/** Fetches the full saved `Flow` for a given `clientId`. Returns `null` when signed out or not found. */
export async function fetchSavedFlow(clientId: number, client: Client = apiClient): Promise<Flow | null> {
  const { data, error } = await getFlow({ path: { clientId } }, { client });
  if (error) {
    const status = httpStatus(error);
    if (status === 401 || status === 404) return null;
    throw new Error("Failed to load this saved flow.");
  }
  return data as Flow;
}

/** Saves (upserts, keyed by `flow.id`) a flow to the current user's account. Throws on failure, `401` included. */
export async function saveFlowToAccount(flow: Flow, client: Client = apiClient): Promise<SavedFlowSummary> {
  const { data, error } = await syncFlow({ path: { clientId: flow.id }, body: { flow } }, { client });
  if (error) {
    throw new Error("Failed to save this flow to your account.");
  }
  return data as SavedFlowSummary;
}

/** Deletes a saved flow from the current user's account. Throws on failure, `401` included. */
export async function deleteSavedFlow(clientId: number, client: Client = apiClient): Promise<void> {
  const { error } = await deleteFlow({ path: { clientId } }, { client });
  if (error) {
    throw new Error("Failed to remove this saved flow.");
  }
}
