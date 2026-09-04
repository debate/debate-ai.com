/**
 * @fileoverview Network calls for the server-backed flow presence transport
 * — closes the "Live 'who's editing now' presence indicators alongside the
 * existing merge preview" follow-up named under TODO.md idea #16 ("Shared,
 * Ai-Generated Debate Flow"). Hits the app's D1-backed `/api/flow-presence`
 * route, mirroring `flow-sync-client.ts`'s split from its polling hook so
 * these fetch calls are unit-testable without mocking timers.
 *
 * @module flow/flow-presence-client
 */

import type { FlowPresenceHeartbeat } from "./flow-presence";

const DEFAULT_ENDPOINT = "/api/flow-presence";

async function readErrorDetail(res: Response): Promise<string> {
  try {
    const payload = (await res.json()) as { error?: string };
    return payload?.error ?? "";
  } catch {
    return "";
  }
}

/**
 * Pulls every collaborator's current heartbeat for `flowId` from the
 * server. Returns the full current set for that flow (not a delta) — a
 * caller should replace, not accumulate, its local copy for this flow with
 * the result.
 *
 * Throws a plain `Error` with a useful message on a non-OK response — the
 * caller (the polling hook) is expected to catch this and keep polling
 * rather than surface it as a hard failure.
 */
export async function pullFlowPresence(
  flowId: number,
  endpoint = DEFAULT_ENDPOINT,
): Promise<FlowPresenceHeartbeat[]> {
  const url = `${endpoint}?flowId=${encodeURIComponent(flowId)}`;
  const res = await fetch(url);

  if (!res.ok) {
    const detail = await readErrorDetail(res);
    throw new Error(detail || `Flow presence pull failed (${res.status}).`);
  }

  const json = (await res.json()) as { heartbeats?: FlowPresenceHeartbeat[] };
  return Array.isArray(json.heartbeats) ? json.heartbeats : [];
}

/**
 * Pushes the local collaborator's "I'm actively editing this flow"
 * heartbeat to the server so other clients polling the same `flowId` see
 * them as active. Upserts by `(flowId, authorId)`, so repeated heartbeats
 * update one row rather than accumulating.
 *
 * Throws a plain `Error` with a useful message on a non-OK response, same
 * caveat as {@link pullFlowPresence}.
 */
export async function pushFlowPresenceHeartbeat(
  heartbeat: FlowPresenceHeartbeat,
  endpoint = DEFAULT_ENDPOINT,
): Promise<void> {
  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(heartbeat),
  });

  if (!res.ok) {
    const detail = await readErrorDetail(res);
    throw new Error(detail || `Flow presence push failed (${res.status}).`);
  }
}
