/**
 * @fileoverview Local cache for `flow/flow-presence.ts`'s heartbeats —
 * closes the "Live 'who's editing now' presence indicators alongside the
 * existing merge preview" follow-up named under TODO.md idea #16 ("Shared,
 * Ai-Generated Debate Flow"). Mirrors `state/flowEdits.ts`'s localStorage
 * persistence convention, with one difference: a poll of `/api/flow-presence`
 * returns the *full current* heartbeat set for a flow (not a delta, unlike
 * `/api/flow-sync`'s edits), so `mergeRemoteFlowPresence` replaces that
 * flow's cached heartbeats wholesale on every successful pull rather than
 * upserting individual rows — a heartbeat the server no longer has (its
 * author stopped polling) should stop showing as active here too.
 *
 * @module state/flowPresence
 */

import type { FlowPresenceHeartbeat } from "../flow/flow-presence";
import { listActiveFlowEditors, type ActiveFlowEditor, type ListActiveFlowEditorsOptions } from "../flow/flow-presence";

const STORAGE_KEY = "flowPresenceHeartbeats";

function readAll(): FlowPresenceHeartbeat[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as FlowPresenceHeartbeat[]) : [];
  } catch {
    return [];
  }
}

function writeAll(heartbeats: FlowPresenceHeartbeat[]): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(heartbeats));
}

/** Lists every cached heartbeat, across all flows. */
export function listFlowPresenceHeartbeats(): FlowPresenceHeartbeat[] {
  return readAll();
}

/**
 * Replaces `flowId`'s cached heartbeats with a freshly pulled set from the
 * server, leaving every other flow's cached heartbeats untouched.
 */
export function mergeRemoteFlowPresence(flowId: number, remote: FlowPresenceHeartbeat[]): void {
  const others = readAll().filter((h) => h.flowId !== flowId);
  writeAll([...others, ...remote]);
}

/**
 * Lists every collaborator still active on `flowId` as of `nowMs`, per the
 * last-pulled server snapshot cached locally. See
 * {@link listActiveFlowEditors} for the freshness/exclusion semantics.
 */
export function listActiveEditorsForFlow(
  flowId: number,
  nowMs: number,
  options?: ListActiveFlowEditorsOptions,
): ActiveFlowEditor[] {
  return listActiveFlowEditors(readAll(), flowId, nowMs, options);
}
