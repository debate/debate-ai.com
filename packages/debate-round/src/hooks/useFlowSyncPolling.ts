/**
 * @fileoverview React binding for the server-backed live sync transport —
 * closes follow-up (a) under TODO.md idea #16 ("Shared, Ai-Generated Debate
 * Flow"): "a live transport (WebSocket or similar) that turns local edits
 * into a shared stream across a room/team". While enabled, polls
 * `/api/flow-sync` for edits newer than the last one seen and folds them
 * into the existing local `state/flowEdits.ts` store (`saveFlowEdit`
 * already dedups by id, so a re-pulled edit is a no-op). Exposes `pushEdit`
 * so a caller that just logged an edit locally (e.g.
 * `panels/FlowEditLogPanel.tsx`) can best-effort broadcast it too.
 *
 * This is intentionally a short-poll transport, not a WebSocket/Durable
 * Object push channel — see `flow/flow-sync-client.ts`'s file doc-comment.
 * A pull/push failure never throws out of this hook; it's surfaced via
 * `status`/`lastError` only, so local logging keeps working regardless of
 * network conditions.
 *
 * @module hooks/useFlowSyncPolling
 */

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Client } from "debate-api-client";
import { pullRemoteFlowEdits, pushFlowEditToServer } from "../flow/flow-sync-client";
import { advanceSyncCursor } from "../flow/flow-sync-cursor";
import type { FlowEdit } from "../flow/shared-flow-sync";
import { saveFlowEdit } from "../state/flowEdits";

const DEFAULT_INTERVAL_MS = 4000;

export type FlowSyncStatus = "idle" | "syncing" | "error";

export type UseFlowSyncPollingOptions = {
  /** Whether the poll loop is currently running. Defaults to `false`. */
  enabled?: boolean;
  /** Milliseconds between polls. Defaults to 4000. */
  intervalMs?: number;
  /** Override for tests / non-default deployments. */
  client?: Client;
};

export type FlowSyncPollingBinding = {
  status: FlowSyncStatus;
  lastError: string | null;
  /** Best-effort push of an already-locally-saved edit to the server. */
  pushEdit: (edit: FlowEdit) => Promise<void>;
};

/**
 * Polls the server for other contributors' edits to `flowId` and pulls them
 * into the local `state/flowEdits.ts` store while `enabled`.
 *
 * @param flowId - The flow ("room") to sync. Polling is a no-op while this
 *   is `undefined` — there's nothing to scope the sync to yet (e.g. before
 *   the round workspace has a flow selected).
 * @param onPulled - Called after each poll that pulled one or more new
 *   edits, so a composing screen's own snapshot of `state/flowEdits.ts` can
 *   refresh in step (mirroring `FlowEditLogPanel`'s `onChange` convention).
 */
export function useFlowSyncPolling(
  flowId: number | undefined,
  onPulled?: () => void,
  options: UseFlowSyncPollingOptions = {},
): FlowSyncPollingBinding {
  const { enabled = false, intervalMs = DEFAULT_INTERVAL_MS, client } = options;

  const [status, setStatus] = useState<FlowSyncStatus>("idle");
  const [lastError, setLastError] = useState<string | null>(null);
  const cursorRef = useRef(0);
  const onPulledRef = useRef(onPulled);
  onPulledRef.current = onPulled;

  useEffect(() => {
    cursorRef.current = 0;
  }, [flowId]);

  useEffect(() => {
    if (!enabled || flowId === undefined) return;

    let cancelled = false;

    const poll = async () => {
      setStatus("syncing");
      try {
        const pulled = await pullRemoteFlowEdits(flowId, cursorRef.current, client);
        if (cancelled) return;
        cursorRef.current = advanceSyncCursor(cursorRef.current, pulled);
        for (const edit of pulled) saveFlowEdit(edit);
        setStatus("idle");
        setLastError(null);
        if (pulled.length > 0) onPulledRef.current?.();
      } catch (error) {
        if (cancelled) return;
        setStatus("error");
        setLastError(error instanceof Error ? error.message : "Flow sync pull failed.");
      }
    };

    poll();
    const id = setInterval(poll, intervalMs);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [enabled, flowId, intervalMs, client]);

  const pushEdit = useCallback(
    async (edit: FlowEdit) => {
      try {
        await pushFlowEditToServer(edit, client);
        setLastError(null);
      } catch (error) {
        setStatus("error");
        setLastError(error instanceof Error ? error.message : "Flow sync push failed.");
      }
    },
    [client],
  );

  return { status, lastError, pushEdit };
}
