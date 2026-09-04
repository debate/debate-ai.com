/**
 * @fileoverview React binding for the server-backed flow presence transport
 * — closes the "Live 'who's editing now' presence indicators alongside the
 * existing merge preview" follow-up named under TODO.md idea #16 ("Shared,
 * Ai-Generated Debate Flow"). Mirrors `hooks/useFlowSyncPolling.ts`: while
 * enabled, pushes the local collaborator's heartbeat and pulls every other
 * collaborator's current heartbeat for the flow from `/api/flow-presence`,
 * exposing the still-active set (self excluded) for a panel to render.
 *
 * A pull/push failure never throws out of this hook; it's surfaced via
 * `status`/`lastError` only, matching `useFlowSyncPolling`'s convention.
 *
 * @module hooks/useFlowPresencePolling
 */

"use client";

import { useEffect, useRef, useState } from "react";
import { pullFlowPresence, pushFlowPresenceHeartbeat } from "../flow/flow-presence-client";
import { listActiveFlowEditors, type ActiveFlowEditor } from "../flow/flow-presence";
import { mergeRemoteFlowPresence } from "../state/flowPresence";

const DEFAULT_INTERVAL_MS = 4000;

export type FlowPresenceStatus = "idle" | "syncing" | "error";

export type UseFlowPresencePollingOptions = {
  /** Whether the poll loop is currently running. Defaults to `false`. */
  enabled?: boolean;
  /** Milliseconds between polls. Defaults to 4000. */
  intervalMs?: number;
  /** Override for tests / non-default deployments. */
  endpoint?: string;
};

export type FlowPresencePollingBinding = {
  status: FlowPresenceStatus;
  lastError: string | null;
  /** Every other collaborator currently active on this flow, most-recent first. */
  activeEditors: ActiveFlowEditor[];
};

/**
 * Pushes `authorId`'s own heartbeat and pulls every other collaborator's
 * current heartbeat for `flowId` while `enabled`.
 *
 * @param flowId - The flow ("room") to track presence for. A no-op while
 *   `undefined` (e.g. before a Flow ID has been entered/selected).
 * @param authorId - The local collaborator's id. A no-op while blank —
 *   there's no one to heartbeat as.
 */
export function useFlowPresencePolling(
  flowId: number | undefined,
  authorId: string,
  options: UseFlowPresencePollingOptions = {},
): FlowPresencePollingBinding {
  const { enabled = false, intervalMs = DEFAULT_INTERVAL_MS, endpoint } = options;

  const [status, setStatus] = useState<FlowPresenceStatus>("idle");
  const [lastError, setLastError] = useState<string | null>(null);
  const [activeEditors, setActiveEditors] = useState<ActiveFlowEditor[]>([]);

  const trimmedAuthorId = authorId.trim();
  const authorIdRef = useRef(trimmedAuthorId);
  authorIdRef.current = trimmedAuthorId;

  useEffect(() => {
    if (!enabled || flowId === undefined || trimmedAuthorId === "") {
      setActiveEditors([]);
      return;
    }

    let cancelled = false;

    const poll = async () => {
      setStatus("syncing");
      try {
        await pushFlowPresenceHeartbeat(
          { flowId, authorId: authorIdRef.current, lastSeenAt: Date.now() },
          endpoint,
        );
        const remote = await pullFlowPresence(flowId, endpoint);
        if (cancelled) return;
        mergeRemoteFlowPresence(flowId, remote);
        setActiveEditors(
          listActiveFlowEditors(remote, flowId, Date.now(), { excludeAuthorId: authorIdRef.current }),
        );
        setStatus("idle");
        setLastError(null);
      } catch (error) {
        if (cancelled) return;
        setStatus("error");
        setLastError(error instanceof Error ? error.message : "Flow presence sync failed.");
      }
    };

    poll();
    const id = setInterval(poll, intervalMs);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [enabled, flowId, trimmedAuthorId, intervalMs, endpoint]);

  return { status, lastError, activeEditors };
}
