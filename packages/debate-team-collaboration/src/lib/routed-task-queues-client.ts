/**
 * @fileoverview Network calls for the routed-task-queue D1 sync (the
 * "account-syncing routed queues across devices" follow-up named under the
 * "🧭 Research Task Routing" bullet in TODO.md's Research Crowdsourcing
 * Organizer Features). Kept separate from `state/savedRoutedTaskQueues.ts`'s
 * pure validation helpers so those stay unit-testable without mocking
 * `fetch`, mirroring `round/drill-sets-client.ts`'s split.
 *
 * Talks to `apps/debate-ai.com`'s `/api/routed-task-queues` routes, which
 * require an authenticated session — `listSavedRoutedTaskQueues` resolves to
 * `null` (rather than throwing) on a `401`, letting the caller
 * (`hooks/useRoutedTaskQueues.ts`) fall back to local-storage-only routed
 * queues instead of showing an error. The write calls
 * (`saveRoutedTaskQueueToAccount`, `deleteSavedRoutedTaskQueueFromAccount`)
 * throw on failure since the caller already has the queue in local state
 * either way — a failed cloud sync is reported but never blocks local
 * saving.
 *
 * @module lib/routed-task-queues-client
 */

import type { RoutedTaskQueueRecord } from "../state/routedTaskQueues";

async function readErrorMessage(res: Response, fallback: string): Promise<string> {
  try {
    const payload = (await res.json()) as { error?: string };
    return payload?.error ?? fallback;
  } catch {
    return fallback;
  }
}

/** Lists every routed task queue synced to the current user's account. Returns `null` when signed out (a `401` response). */
export async function listSavedRoutedTaskQueues(
  endpoint = "/api/routed-task-queues",
): Promise<RoutedTaskQueueRecord[] | null> {
  const res = await fetch(endpoint);
  if (res.status === 401) return null;
  if (!res.ok) {
    throw new Error(await readErrorMessage(res, "Failed to load your synced task queues."));
  }
  return (await res.json()) as RoutedTaskQueueRecord[];
}

/** Saves (upserts, keyed by `record.topicId`) a routed task queue to the current user's account. Throws on failure, `401` included. */
export async function saveRoutedTaskQueueToAccount(
  record: RoutedTaskQueueRecord,
  endpoint = "/api/routed-task-queues",
): Promise<void> {
  const res = await fetch(`${endpoint}/${encodeURIComponent(record.topicId)}`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ record }),
  });
  if (!res.ok) {
    throw new Error(await readErrorMessage(res, "Failed to sync this task queue to your account."));
  }
}

/** Deletes a synced routed task queue from the current user's account. Throws on failure, `401` included. */
export async function deleteSavedRoutedTaskQueueFromAccount(
  topicId: string,
  endpoint = "/api/routed-task-queues",
): Promise<void> {
  const res = await fetch(`${endpoint}/${encodeURIComponent(topicId)}`, { method: "DELETE" });
  if (!res.ok) {
    throw new Error(await readErrorMessage(res, "Failed to remove this synced task queue."));
  }
}
