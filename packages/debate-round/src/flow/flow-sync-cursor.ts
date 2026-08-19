/**
 * @fileoverview Pure cursor bookkeeping for the live sync transport's
 * polling loop (`hooks/useFlowSyncPolling.ts`) — kept separate from the
 * hook so it's unit-testable without mocking timers/`fetch`, mirroring this
 * package's `flow-sync-client.ts` split.
 *
 * @module flow/flow-sync-cursor
 */

import type { FlowEdit } from "./shared-flow-sync";

/**
 * Returns the cursor to poll from next: the latest `timestampMs` among
 * `current` and every edit in `pulled`. A poll that returns nothing new
 * leaves the cursor unchanged. Never non-monotonic — a `pulled` edit older
 * than `current` (e.g. server clock skew) can't move the cursor backwards.
 */
export function advanceSyncCursor(current: number, pulled: FlowEdit[]): number {
  return pulled.reduce((max, edit) => Math.max(max, edit.timestampMs), current);
}
