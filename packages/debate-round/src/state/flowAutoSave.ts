/**
 * @fileoverview Debounced auto-save of flows to the user's account
 * (`saved_flows`).
 *
 * Only flows whose status is `"unsaved"` are saved: the user already saved
 * them once (or the account confirmed their copy after a reload), so this
 * never uploads a flow the user has not chosen to put on their account. Each
 * save sends the last confirmed `updatedAt` as `baseUpdatedAt` and never
 * forces, so a copy saved from another device is reported as a conflict and
 * left alone for the user to resolve in Flow History. A failed or conflicting
 * flow is retried only after its content changes again.
 *
 * @module state/flowAutoSave
 */

import type { Flow } from "../types/flow";
import { saveFlowToAccount, type SaveFlowResult } from "../round/saved-flows-client";
import { getFlowAccountStatus, getFlowAccountUpdatedAt, recordFlowSavedToAccount } from "./flowAccountStatus";
import { hashFlowContent } from "./bulkRoundSave";

export const FLOW_AUTO_SAVE_DELAY_MS = 5000;

export interface FlowAutoSaveDeps {
  save?: (flow: Flow, opts: { baseUpdatedAt: string | null }) => Promise<SaveFlowResult>;
  delayMs?: number;
}

export interface FlowAutoSaver {
  /** Notes the latest flows and (re)starts the debounce timer. */
  schedule: (flows: readonly Flow[]) => void;
  /** Saves immediately; resolves to the ids saved. Never rejects. */
  flush: () => Promise<number[]>;
  /** Cancels any pending save. */
  dispose: () => void;
}

export function createFlowAutoSaver(deps: FlowAutoSaveDeps = {}): FlowAutoSaver {
  const save = deps.save ?? ((flow, opts) => saveFlowToAccount(flow, opts));
  const delayMs = deps.delayMs ?? FLOW_AUTO_SAVE_DELAY_MS;
  let latest: readonly Flow[] = [];
  let timer: ReturnType<typeof setTimeout> | null = null;
  let running: Promise<number[]> | null = null;
  /** Content hash of the last attempt that failed or conflicted, by flow id. */
  const blocked = new Map<number, string>();

  const clearTimer = () => {
    if (timer !== null) clearTimeout(timer);
    timer = null;
  };

  const run = async (): Promise<number[]> => {
    const saved: number[] = [];
    for (const flow of latest) {
      if (flow.archived || getFlowAccountStatus(flow) !== "unsaved") continue;
      const hash = hashFlowContent(flow);
      if (blocked.get(flow.id) === hash) continue;
      try {
        const result = await save(flow, { baseUpdatedAt: getFlowAccountUpdatedAt(flow) });
        if (result.conflict) {
          blocked.set(flow.id, hash);
          continue;
        }
        blocked.delete(flow.id);
        recordFlowSavedToAccount(flow, result.summary.updatedAt);
        saved.push(flow.id);
      } catch {
        blocked.set(flow.id, hash);
      }
    }
    return saved;
  };

  const flush = (): Promise<number[]> => {
    clearTimer();
    // Serialize: a flush while a run is in flight waits, then re-checks.
    running = (running ?? Promise.resolve([] as number[])).then(run);
    const current = running;
    void current.then(() => {
      if (running === current) running = null;
    });
    return current;
  };

  return {
    schedule(flows) {
      latest = flows;
      clearTimer();
      timer = setTimeout(() => void flush(), delayMs);
    },
    flush,
    dispose: clearTimer,
  };
}
