/**
 * @fileoverview Network calls for the server-backed live sync transport —
 * closes follow-up (a) under TODO.md idea #16 ("Shared, Ai-Generated Debate
 * Flow"): "a live transport (WebSocket or similar) that turns local edits
 * into a shared stream across a room/team". Hits the app's D1-backed
 * `/api/flow-sync` route (via `debate-api-client`; a short-poll transport,
 * not a WebSocket/Durable Object push channel — acceptable per the
 * follow-up's "or similar" wording). Kept separate from the polling hook
 * that drives it so these calls can be unit-tested without mocking timers,
 * mirroring `round/coach-feedback-client.ts`'s split from its caller.
 *
 * @module flow/flow-sync-client
 */

import { pullFlowEdits, pushFlowEdit, type Client } from "debate-api-client";
import { apiClient } from "../lib/api-client";
import type { FlowEdit } from "./shared-flow-sync";

/**
 * Pulls every `FlowEdit` recorded for `flowId` newer than `sinceMs` from the
 * server, oldest first. Pass `sinceMs` as the highest `timestampMs` already
 * seen so a poll only returns genuinely new edits.
 *
 * Throws a plain `Error` on failure — the caller (the polling hook) is
 * expected to catch this and keep polling rather than surface it as a hard
 * failure, since this is a best-effort sync channel over local-first
 * `state/flowEdits.ts`.
 */
export async function pullRemoteFlowEdits(
  flowId: number,
  sinceMs: number,
  client: Client = apiClient,
): Promise<FlowEdit[]> {
  const { data, error } = await pullFlowEdits({ query: { flowId, sinceMs } }, { client });

  if (error) {
    throw new Error("Flow sync pull failed.");
  }

  return Array.isArray(data?.edits) ? (data.edits as unknown as FlowEdit[]) : [];
}

/**
 * Pushes one locally-logged `FlowEdit` to the server so other clients
 * polling the same `flowId` can pull it. Upserts by `edit.id`, so pushing
 * the same edit twice (e.g. a retry) is a no-op rather than a duplicate.
 *
 * Throws a plain `Error` on failure, same caveat as {@link pullRemoteFlowEdits}.
 */
export async function pushFlowEditToServer(edit: FlowEdit, client: Client = apiClient): Promise<void> {
  const { error } = await pushFlowEdit({ body: edit }, { client });

  if (error) {
    throw new Error("Flow sync push failed.");
  }
}
