/**
 * @fileoverview Network calls for the counsel-panel-assessment-history D1
 * sync (TODO.md idea #4's "a timeline of past AI counsel-panel assessments
 * for a round, not just the latest" follow-up). Kept separate from
 * `state/savedCounselPanelAssessments.ts`'s pure validation helpers so those
 * stay unit-testable without mocking the API client, mirroring
 * `round/judge-decisions-client.ts`'s split.
 *
 * Talks to `apps/debate-ai.com`'s `/api/counsel-panel-assessments` routes
 * (via `debate-api-client`), which require an authenticated session —
 * `listSavedCounselPanelAssessments` resolves to `null` (rather than
 * throwing) on a `401`, letting the caller
 * (`hooks/useCounselPanelAssessments.ts`) fall back to
 * local-storage-only history instead of showing an error. The write calls
 * (`saveCounselPanelAssessmentToAccount`,
 * `deleteSavedCounselPanelAssessmentFromAccount`) throw on failure since the
 * caller already has the assessment in local state either way — a failed
 * cloud sync is reported but never blocks local saving.
 *
 * @module flow/counsel-panel-assessments-client
 */

import {
  deleteCounselPanelAssessment,
  listCounselPanelAssessments,
  syncCounselPanelAssessment,
  type Client,
} from "debate-api-client";
import { apiClient, httpStatus } from "../lib/api-client";
import type { CounselPanelAssessmentRecord } from "../state/counselPanelAssessments";

/** Lists every counsel-panel assessment synced to the current user's account. Returns `null` when signed out (a `401` response). */
export async function listSavedCounselPanelAssessments(
  client: Client = apiClient,
): Promise<CounselPanelAssessmentRecord[] | null> {
  const { data, error } = await listCounselPanelAssessments({}, { client });
  if (error) {
    if (httpStatus(error) === 401) return null;
    throw new Error("Failed to load your synced counsel-panel assessments.");
  }
  return (data ?? []) as CounselPanelAssessmentRecord[];
}

/** Saves (upserts, keyed by `record.id`) a counsel-panel assessment to the current user's account. Throws on failure, `401` included. */
export async function saveCounselPanelAssessmentToAccount(
  record: CounselPanelAssessmentRecord,
  client: Client = apiClient,
): Promise<void> {
  const { error } = await syncCounselPanelAssessment(
    { path: { assessmentId: record.id }, body: { record } },
    { client },
  );
  if (error) {
    throw new Error("Failed to sync this counsel-panel assessment to your account.");
  }
}

/** Deletes a synced counsel-panel assessment from the current user's account. Throws on failure, `401` included. */
export async function deleteSavedCounselPanelAssessmentFromAccount(
  id: string,
  client: Client = apiClient,
): Promise<void> {
  const { error } = await deleteCounselPanelAssessment({ path: { assessmentId: id } }, { client });
  if (error) {
    throw new Error("Failed to remove this synced counsel-panel assessment.");
  }
}
