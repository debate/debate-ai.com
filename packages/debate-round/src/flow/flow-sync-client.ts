/**
 * @fileoverview Network calls for the server-backed live sync transport —
 * closes follow-up (a) under TODO.md idea #16 ("Shared, Ai-Generated Debate
 * Flow"): "a live transport (WebSocket or similar) that turns local edits
 * into a shared stream across a room/team". Hits the app's D1-backed
 * `/api/flow-sync` route (a short-poll transport, not a WebSocket/Durable
 * Object push channel — acceptable per the follow-up's "or similar"
 * wording). Kept separate from the polling hook that drives it so these
 * fetch calls can be unit-tested without mocking timers, mirroring
 * `round/coach-feedback-client.ts`'s split from its caller.
 *
 * @module flow/flow-sync-client
 */

import type { FlowEdit } from "./shared-flow-sync";

const DEFAULT_ENDPOINT = "/api/flow-sync";

async function readErrorDetail(res: Response): Promise<string> {
  try {
    const payload = (await res.json()) as { error?: string };
    return payload?.error ?? "";
  } catch {
    return "";
  }
}

/**
 * Pulls every `FlowEdit` recorded for `flowId` newer than `sinceMs` from the
 * server, oldest first. Pass `sinceMs` as the highest `timestampMs` already
 * seen so a poll only returns genuinely new edits.
 *
 * Throws a plain `Error` with a useful message on a non-OK response — the
 * caller (the polling hook) is expected to catch this and keep polling
 * rather than surface it as a hard failure, since this is a best-effort
 * sync channel over local-first `state/flowEdits.ts`.
 */
export async function pullRemoteFlowEdits(
  flowId: number,
  sinceMs: number,
  endpoint = DEFAULT_ENDPOINT,
): Promise<FlowEdit[]> {
  const url = `${endpoint}?flowId=${encodeURIComponent(flowId)}&sinceMs=${encodeURIComponent(sinceMs)}`;
  const res = await fetch(url);

  if (!res.ok) {
    const detail = await readErrorDetail(res);
    throw new Error(detail || `Flow sync pull failed (${res.status}).`);
  }

  const json = (await res.json()) as { edits?: FlowEdit[] };
  return Array.isArray(json.edits) ? json.edits : [];
}

/**
 * Pushes one locally-logged `FlowEdit` to the server so other clients
 * polling the same `flowId` can pull it. Upserts by `edit.id`, so pushing
 * the same edit twice (e.g. a retry) is a no-op rather than a duplicate.
 *
 * Throws a plain `Error` with a useful message on a non-OK response, same
 * caveat as {@link pullRemoteFlowEdits}.
 */
export async function pushFlowEditToServer(
  edit: FlowEdit,
  endpoint = DEFAULT_ENDPOINT,
): Promise<void> {
  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(edit),
  });

  if (!res.ok) {
    const detail = await readErrorDetail(res);
    throw new Error(detail || `Flow sync push failed (${res.status}).`);
  }
}
