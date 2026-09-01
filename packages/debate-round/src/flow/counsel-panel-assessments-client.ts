/**
 * @fileoverview Network calls for the counsel-panel-assessment-history D1
 * sync (TODO.md idea #4's "a timeline of past AI counsel-panel assessments
 * for a round, not just the latest" follow-up). Kept separate from
 * `state/savedCounselPanelAssessments.ts`'s pure validation helpers so those
 * stay unit-testable without mocking `fetch`, mirroring
 * `round/judge-decisions-client.ts`'s split.
 *
 * Talks to `apps/debate-ai.com`'s `/api/counsel-panel-assessments` routes,
 * which require an authenticated session — `listSavedCounselPanelAssessments`
 * resolves to `null` (rather than throwing) on a `401`, letting the caller
 * (`hooks/useCounselPanelAssessments.ts`) fall back to
 * local-storage-only history instead of showing an error. The write calls
 * (`saveCounselPanelAssessmentToAccount`,
 * `deleteSavedCounselPanelAssessmentFromAccount`) throw on failure since the
 * caller already has the assessment in local state either way — a failed
 * cloud sync is reported but never blocks local saving.
 *
 * @module flow/counsel-panel-assessments-client
 */

import type { CounselPanelAssessmentRecord } from "../state/counselPanelAssessments";

async function readErrorMessage(res: Response, fallback: string): Promise<string> {
  try {
    const payload = (await res.json()) as { error?: string };
    return payload?.error ?? fallback;
  } catch {
    return fallback;
  }
}

/** Lists every counsel-panel assessment synced to the current user's account. Returns `null` when signed out (a `401` response). */
export async function listSavedCounselPanelAssessments(
  endpoint = "/api/counsel-panel-assessments",
): Promise<CounselPanelAssessmentRecord[] | null> {
  const res = await fetch(endpoint);
  if (res.status === 401) return null;
  if (!res.ok) {
    throw new Error(await readErrorMessage(res, "Failed to load your synced counsel-panel assessments."));
  }
  return (await res.json()) as CounselPanelAssessmentRecord[];
}

/** Saves (upserts, keyed by `record.id`) a counsel-panel assessment to the current user's account. Throws on failure, `401` included. */
export async function saveCounselPanelAssessmentToAccount(
  record: CounselPanelAssessmentRecord,
  endpoint = "/api/counsel-panel-assessments",
): Promise<void> {
  const res = await fetch(`${endpoint}/${encodeURIComponent(record.id)}`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ record }),
  });
  if (!res.ok) {
    throw new Error(await readErrorMessage(res, "Failed to sync this counsel-panel assessment to your account."));
  }
}

/** Deletes a synced counsel-panel assessment from the current user's account. Throws on failure, `401` included. */
export async function deleteSavedCounselPanelAssessmentFromAccount(
  id: string,
  endpoint = "/api/counsel-panel-assessments",
): Promise<void> {
  const res = await fetch(`${endpoint}/${encodeURIComponent(id)}`, { method: "DELETE" });
  if (!res.ok) {
    throw new Error(await readErrorMessage(res, "Failed to remove this synced counsel-panel assessment."));
  }
}
