/**
 * @fileoverview Network calls for the flow cloud save D1 sync (TODO.md idea
 * #17, follow-up (3), "flows" half). Kept separate from
 * `state/savedFlows.ts`'s pure validation/derivation helpers so those stay
 * unit-testable without mocking `fetch`, mirroring
 * `round/user-settings-client.ts`'s split.
 *
 * Talks to `apps/debate-ai.com`'s `/api/flows` routes, which require an
 * authenticated session — the read calls (`listSavedFlows`,
 * `fetchSavedFlow`) resolve to `null` (rather than throwing) on a `401`,
 * letting the caller fall back to "sign in to sync" UI instead of showing
 * an error. The write calls (`saveFlowToAccount`, `deleteSavedFlow`) throw
 * on failure since the caller already has the flow in local state either
 * way — a failed cloud sync is reported but never blocks local editing.
 *
 * @module round/saved-flows-client
 */

import type { Flow } from "debate-core/src/types/flow";
import type { SavedFlowSummary } from "../state/savedFlows";

async function readErrorMessage(res: Response, fallback: string): Promise<string> {
  try {
    const payload = (await res.json()) as { error?: string };
    return payload?.error ?? fallback;
  } catch {
    return fallback;
  }
}

/** Lists the current user's saved flows (summaries only). Returns `null` when signed out (a `401` response). */
export async function listSavedFlows(endpoint = "/api/flows"): Promise<SavedFlowSummary[] | null> {
  const res = await fetch(endpoint);
  if (res.status === 401) return null;
  if (!res.ok) {
    throw new Error(await readErrorMessage(res, "Failed to load your saved flows."));
  }
  return (await res.json()) as SavedFlowSummary[];
}

/** Fetches the full saved `Flow` for a given `clientId`. Returns `null` when signed out or not found. */
export async function fetchSavedFlow(clientId: number, endpoint = "/api/flows"): Promise<Flow | null> {
  const res = await fetch(`${endpoint}/${clientId}`);
  if (res.status === 401 || res.status === 404) return null;
  if (!res.ok) {
    throw new Error(await readErrorMessage(res, "Failed to load this saved flow."));
  }
  return (await res.json()) as Flow;
}

/** Saves (upserts, keyed by `flow.id`) a flow to the current user's account. Throws on failure, `401` included. */
export async function saveFlowToAccount(flow: Flow, endpoint = "/api/flows"): Promise<SavedFlowSummary> {
  const res = await fetch(`${endpoint}/${flow.id}`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ flow }),
  });
  if (!res.ok) {
    throw new Error(await readErrorMessage(res, "Failed to save this flow to your account."));
  }
  return (await res.json()) as SavedFlowSummary;
}

/** Deletes a saved flow from the current user's account. Throws on failure, `401` included. */
export async function deleteSavedFlow(clientId: number, endpoint = "/api/flows"): Promise<void> {
  const res = await fetch(`${endpoint}/${clientId}`, { method: "DELETE" });
  if (!res.ok) {
    throw new Error(await readErrorMessage(res, "Failed to remove this saved flow."));
  }
}
