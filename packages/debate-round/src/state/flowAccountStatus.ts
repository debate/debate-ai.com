/**
 * @fileoverview In-memory record of which flows' current content has reached
 * the user's account (`saved_flows`), so the flow tabs can show a "Saved to
 * account" marker without opening the save dialog.
 *
 * The dialog used to keep this only in its own component state, which was
 * lost every time it closed. Here it lives at module scope with a tiny
 * subscribe API (for `useSyncExternalStore`), keyed by flow id and compared by
 * `hashFlowContent` — the same fingerprint the dialog's bulk save already uses
 * to skip clean flows.
 *
 * Not persisted on purpose: after a reload there is no baseline, so a tab
 * reports `"unknown"` rather than guessing "saved" or "unsaved".
 *
 * @module state/flowAccountStatus
 */

import type { Flow } from "../types/flow";
import { hashFlowContent } from "./bulkRoundSave";

/** `"saved"`: matches the last account save. `"unsaved"`: edited since. `"unknown"`: no baseline this session. */
export type FlowAccountStatus = "saved" | "unsaved" | "unknown";

const savedHashes = new Map<number, string>();
const listeners = new Set<() => void>();
let version = 0;

function notify(): void {
  version += 1;
  for (const listener of listeners) listener();
}

/** Records that `flow`'s current content is what the account now holds. */
export function recordFlowSavedToAccount(flow: Flow): void {
  savedHashes.set(flow.id, hashFlowContent(flow));
  notify();
}

/** Forgets a flow's baseline (it was deleted, or the user signed out). */
export function forgetFlowAccountStatus(flowId: number): void {
  if (savedHashes.delete(flowId)) notify();
}

/** Forgets every baseline — what a sign-out leaves behind. */
export function resetFlowAccountStatus(): void {
  if (savedHashes.size === 0) return;
  savedHashes.clear();
  notify();
}

/** Whether `flow`'s current content has reached the account this session. */
export function getFlowAccountStatus(flow: Flow): FlowAccountStatus {
  const saved = savedHashes.get(flow.id);
  if (saved === undefined) return "unknown";
  return saved === hashFlowContent(flow) ? "saved" : "unsaved";
}

/** Subscribe to baseline changes; returns the unsubscribe function. */
export function subscribeFlowAccountStatus(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** A number that changes whenever any baseline does — the `useSyncExternalStore` snapshot. */
export function getFlowAccountStatusVersion(): number {
  return version;
}
