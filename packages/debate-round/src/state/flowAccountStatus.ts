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
 * After a reload there is no baseline, so a tab reports `"unknown"` rather
 * than guessing "saved" or "unsaved" — unless the baseline can be proven. Each
 * save also stores `{ hash, updatedAt }` in localStorage, and
 * `restoreFlowAccountBaselines` adopts one only when the account's own list
 * reports that same `updatedAt` for the same id. A different user signing in
 * on this browser (or a copy saved elsewhere since) never matches, so a stale
 * entry can only fail to restore, never claim "saved" wrongly.
 *
 * @module state/flowAccountStatus
 */

import type { Flow, Round } from "../types/flow";
import { hashFlowContent, hashRoundContent } from "./bulkRoundSave";

/** `"saved"`: matches the last account save. `"unsaved"`: edited since. `"unknown"`: no baseline this session. */
export type FlowAccountStatus = "saved" | "unsaved" | "unknown";

const STORAGE_KEY = "debate:account-save-baselines";

const savedHashes = new Map<number, string>();
// Rounds get their own map: flow and round ids come from separate counters.
const savedRoundHashes = new Map<number, string>();

/** A save the account confirmed: the content fingerprint and the `updatedAt` the server stamped on it. */
interface PersistedBaseline {
  hash: string;
  updatedAt: string;
}
type PersistedBaselines = { flows: Record<string, PersistedBaseline>; rounds: Record<string, PersistedBaseline> };

function emptyPersisted(): PersistedBaselines {
  return { flows: {}, rounds: {} };
}

function isBaseline(value: unknown): value is PersistedBaseline {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as PersistedBaseline).hash === "string" &&
    typeof (value as PersistedBaseline).updatedAt === "string"
  );
}

function readRecords(value: unknown): Record<string, PersistedBaseline> {
  const out: Record<string, PersistedBaseline> = {};
  if (typeof value !== "object" || value === null) return out;
  for (const [id, entry] of Object.entries(value)) {
    if (isBaseline(entry)) out[id] = { hash: entry.hash, updatedAt: entry.updatedAt };
  }
  return out;
}

function readPersisted(): PersistedBaselines {
  if (typeof localStorage === "undefined") return emptyPersisted();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyPersisted();
    const parsed = JSON.parse(raw) as { flows?: unknown; rounds?: unknown };
    return { flows: readRecords(parsed?.flows), rounds: readRecords(parsed?.rounds) };
  } catch {
    return emptyPersisted();
  }
}

function writePersisted(next: PersistedBaselines): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Quota or privacy mode: the in-memory baseline still works for this session.
  }
}

function persistBaseline(kind: keyof PersistedBaselines, id: number, baseline: PersistedBaseline | null): void {
  const persisted = readPersisted();
  if (baseline) persisted[kind][String(id)] = baseline;
  else delete persisted[kind][String(id)];
  writePersisted(persisted);
}
const listeners = new Set<() => void>();
let version = 0;

function notify(): void {
  version += 1;
  for (const listener of listeners) listener();
}

/**
 * Records that `flow`'s current content is what the account now holds.
 * Pass the save response's `updatedAt` so the baseline can be restored after a
 * reload (see `restoreFlowAccountBaselines`).
 */
export function recordFlowSavedToAccount(flow: Flow, updatedAt?: string): void {
  const hash = hashFlowContent(flow);
  savedHashes.set(flow.id, hash);
  if (updatedAt) persistBaseline("flows", flow.id, { hash, updatedAt });
  notify();
}

/**
 * The `updatedAt` the account stamped on the save this browser last confirmed
 * for `flow`, or `null` when there is none or it no longer matches the baseline.
 * Used as `baseUpdatedAt` so a later save can't silently overwrite a newer copy.
 */
export function getFlowAccountUpdatedAt(flow: Flow): string | null {
  const baseline = readPersisted().flows[String(flow.id)];
  if (!baseline || baseline.hash !== savedHashes.get(flow.id)) return null;
  return baseline.updatedAt;
}

/** Forgets a flow's baseline (it was deleted, or the user signed out). */
export function forgetFlowAccountStatus(flowId: number): void {
  persistBaseline("flows", flowId, null);
  if (savedHashes.delete(flowId)) notify();
}

/** Forgets every baseline, in memory and persisted — what a sign-out leaves behind. */
export function resetFlowAccountStatus(): void {
  writePersisted(emptyPersisted());
  if (savedHashes.size === 0 && savedRoundHashes.size === 0) return;
  savedHashes.clear();
  savedRoundHashes.clear();
  notify();
}

/** Records that `round`'s current content is what the account now holds. See {@link recordFlowSavedToAccount}. */
export function recordRoundSavedToAccount(round: Round, updatedAt?: string): void {
  const hash = hashRoundContent(round);
  savedRoundHashes.set(round.id, hash);
  if (updatedAt) persistBaseline("rounds", round.id, { hash, updatedAt });
  notify();
}

/** Forgets a round's baseline (it was deleted). */
export function forgetRoundAccountStatus(roundId: number): void {
  persistBaseline("rounds", roundId, null);
  if (savedRoundHashes.delete(roundId)) notify();
}

/** An account list row, as `GET /api/flows` and `GET /api/rounds` return it. */
export interface AccountSaveSummary {
  clientId: number;
  updatedAt: string;
}

function restoreInto(
  target: Map<number, string>,
  stored: Record<string, PersistedBaseline>,
  summaries: readonly AccountSaveSummary[],
): boolean {
  let changed = false;
  for (const summary of summaries) {
    if (target.has(summary.clientId)) continue;
    const entry = stored[String(summary.clientId)];
    if (entry && entry.updatedAt === summary.updatedAt) {
      target.set(summary.clientId, entry.hash);
      changed = true;
    }
  }
  return changed;
}

/**
 * Re-adopts persisted baselines the account confirms: an entry is restored only
 * when the account's list holds the same `updatedAt` for that id, which proves
 * the account still has exactly what this browser last saved. Never overrides
 * a baseline already recorded this session.
 *
 * @param flows - The account's saved-flow list (`listSavedFlows`).
 * @param rounds - The account's saved-round list (`listSavedRounds`).
 */
export function restoreFlowAccountBaselines(
  flows: readonly AccountSaveSummary[],
  rounds: readonly AccountSaveSummary[] = [],
): void {
  const stored = readPersisted();
  const flowsChanged = restoreInto(savedHashes, stored.flows, flows);
  const roundsChanged = restoreInto(savedRoundHashes, stored.rounds, rounds);
  if (flowsChanged || roundsChanged) notify();
}

/** Whether `round`'s current content has reached the account this session. */
export function getRoundAccountStatus(round: Round): FlowAccountStatus {
  const saved = savedRoundHashes.get(round.id);
  if (saved === undefined) return "unknown";
  return saved === hashRoundContent(round) ? "saved" : "unsaved";
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
