/**
 * @fileoverview Restores the "Saved to account" markers after a reload without
 * waiting for the Flow History "Saved to account" tab to be opened.
 *
 * `restoreAccountBaselinesOnce` fetches the account's flow and round lists and
 * hands them to `restoreFlowAccountBaselines`, which only adopts a persisted
 * baseline when the account reports the same `updatedAt`. It runs at most once
 * per page session (concurrent callers share one request), and a signed-out
 * user or a failed request is a quiet no-op — markers just stay `"unknown"`.
 *
 * @module state/restoreAccountBaselines
 */

import { listSavedFlows } from "../round/saved-flows-client";
import { listSavedRounds } from "../round/saved-rounds-client";
import { restoreFlowAccountBaselines, type AccountSaveSummary } from "./flowAccountStatus";

/** The two account list calls; each resolves to `null` when signed out. */
export interface BaselineListSources {
  listFlows: () => Promise<readonly AccountSaveSummary[] | null>;
  listRounds: () => Promise<readonly AccountSaveSummary[] | null>;
}

const defaultSources: BaselineListSources = {
  listFlows: () => listSavedFlows(),
  listRounds: () => listSavedRounds(),
};

let inflight: Promise<void> | null = null;

/**
 * Restores persisted baselines against the account's lists, once per session.
 * Never rejects. A failed or signed-out fetch is not remembered as done, so a
 * later mount (e.g. after signing in) tries again.
 */
export function restoreAccountBaselinesOnce(sources: BaselineListSources = defaultSources): Promise<void> {
  if (inflight) return inflight;
  const attempt = (async () => {
    const [flows, rounds] = await Promise.all([sources.listFlows(), sources.listRounds()]);
    if (flows === null && rounds === null) throw new Error("signed out");
    restoreFlowAccountBaselines(flows ?? [], rounds ?? []);
  })();
  inflight = attempt.catch(() => {
    inflight = null;
  });
  return inflight;
}

/** Clears the once-per-session guard (tests, and sign-out). */
export function resetRestoreAccountBaselines(): void {
  inflight = null;
}
