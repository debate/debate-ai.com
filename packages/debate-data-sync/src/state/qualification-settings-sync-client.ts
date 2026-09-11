/**
 * @fileoverview Network calls for the Standings tab's qualification-settings
 * account sync (`qualificationPointsTable.ts`/`qualificationCutoff.ts`'s
 * sync helpers) — packages/debate-help-docs/content/docs/features/team-rankings.mdx's "Standings data...
 * stored in localStorage only" Known gap. Talks directly to
 * `apps/debate-ai.com`'s `/api/settings` route via `fetch`, mirroring
 * `debate-team-collaboration`'s `lib/research-progress-goal-sync-client.ts`
 * split (kept separate from the pure validation helpers so those stay
 * unit-testable without mocking `fetch`).
 *
 * `/api/settings` requires an authenticated session — both fetch functions
 * resolve to `null` (rather than throwing) on a `401`, letting the caller
 * fall back to `localStorage` for a signed-out browser.
 *
 * @module state/qualification-settings-sync-client
 */

import type { QualificationPointsTable } from "../rankings/ndca-standings";
import type { QualificationCutoffSettings } from "./qualificationCutoff";

async function readErrorMessage(res: Response, fallback: string): Promise<string> {
  try {
    const payload = (await res.json()) as { error?: string };
    return payload?.error ?? fallback;
  } catch {
    return fallback;
  }
}

/** Fetches the current user's synced qualification points table. Returns `null` when signed out (a `401` response), distinct from a signed-in user with nothing synced (`{ qualificationPointsTable: null }`). */
export async function fetchQualificationPointsTable(
  endpoint = "/api/settings",
): Promise<{ qualificationPointsTable: QualificationPointsTable | null } | null> {
  const res = await fetch(endpoint);
  if (res.status === 401) return null;
  if (!res.ok) {
    throw new Error(await readErrorMessage(res, "Failed to load account settings."));
  }
  const payload = (await res.json()) as { qualificationPointsTable?: QualificationPointsTable | null };
  return { qualificationPointsTable: payload.qualificationPointsTable ?? null };
}

/** Saves (or, with `null`, clears) the synced qualification points table for the current user. Throws on failure — the caller is expected to have already applied the change locally. */
export async function saveQualificationPointsTable(
  table: QualificationPointsTable | null,
  endpoint = "/api/settings",
): Promise<void> {
  const res = await fetch(endpoint, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ qualificationPointsTable: table }),
  });
  if (!res.ok) {
    throw new Error(await readErrorMessage(res, "Failed to save account settings."));
  }
}

/** Fetches the current user's synced qualification cutoff. Returns `null` when signed out (a `401` response), distinct from a signed-in user with nothing synced (`{ qualificationCutoff: null }`). */
export async function fetchQualificationCutoff(
  endpoint = "/api/settings",
): Promise<{ qualificationCutoff: QualificationCutoffSettings | null } | null> {
  const res = await fetch(endpoint);
  if (res.status === 401) return null;
  if (!res.ok) {
    throw new Error(await readErrorMessage(res, "Failed to load account settings."));
  }
  const payload = (await res.json()) as { qualificationCutoff?: QualificationCutoffSettings | null };
  return { qualificationCutoff: payload.qualificationCutoff ?? null };
}

/** Saves (or, with `null`, clears) the synced qualification cutoff for the current user. Throws on failure — the caller is expected to have already applied the change locally. */
export async function saveQualificationCutoff(
  cutoff: QualificationCutoffSettings | null,
  endpoint = "/api/settings",
): Promise<void> {
  const res = await fetch(endpoint, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ qualificationCutoff: cutoff }),
  });
  if (!res.ok) {
    throw new Error(await readErrorMessage(res, "Failed to save account settings."));
  }
}
