/**
 * @fileoverview Network call for Create New Round invites — a user request:
 * "this should be linked and have autocomplete of registered user.
 * otherwise send an email to that person invited with an invite to join a
 * round" (see TODO.md's "Create New Round — registered-user autocomplete +
 * invite notifications" Completed entry). `useRoundEditorForm.ts` calls
 * `sendRoundInvites` right after a new round is created, passing every
 * non-empty debater/judge/spectator email; `apps/debate-ai.com`'s
 * `/api/rounds/invite` resolves each one to either an in-app notification
 * (registered user) or an email invite (everyone else).
 *
 * Kept separate from `useRoundEditorForm.ts` so the fetch/error-shape logic
 * is unit-testable without mounting the form, mirroring
 * `round/round-pairings-client.ts`'s split. Never throws — a failed invite
 * dispatch shouldn't block or roll back the round, which is already created
 * locally either way — callers get `null` on any failure and can decide
 * whether to surface that.
 *
 * @module round/round-invite-client
 */

export interface RoundInviteResult {
  notified: string[];
  emailed: string[];
  skipped: string[];
}

export interface RoundInviteRequest {
  emails: string[];
  tournamentName: string;
  roundLevel: string;
  slug: string | null;
}

/**
 * Diffs an edited round's debater/judge/spectator emails against the same
 * round's emails before the edit, returning only the ones newly added —
 * so saving an edit to an already-created round invites just-added judges/
 * spectators/debaters without re-notifying everyone already on the round
 * (see `packages/debate-help-docs/content/docs/features/round-invites-and-notifications.mdx`'s Known gaps:
 * "Only round creation sends invites").
 *
 * Comparison is case-insensitive and blank entries are ignored; the
 * returned list is deduped and preserves each email's first-seen casing
 * from `nextEmails`.
 */
export function computeAddedInviteEmails(
  previousEmails: string[],
  nextEmails: string[],
): string[] {
  const previousSet = new Set(
    previousEmails
      .map((email) => email.trim().toLowerCase())
      .filter((email) => email.length > 0),
  );

  const seen = new Set<string>();
  const added: string[] = [];
  for (const email of nextEmails) {
    const trimmed = email.trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    if (!previousSet.has(key)) added.push(trimmed);
  }
  return added;
}

/**
 * Posts a Create New Round invite request. Resolves to `null` (rather than
 * throwing) when signed out (`401`) or on any other failure — the caller
 * already created the round locally, so an invite failure is reported, not
 * fatal.
 */
export async function sendRoundInvites(
  request: RoundInviteRequest,
  endpoint = "/api/rounds/invite",
): Promise<RoundInviteResult | null> {
  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(request),
    });
    if (!res.ok) return null;
    return (await res.json()) as RoundInviteResult;
  } catch (error) {
    console.error("Unable to send round invites:", error);
    return null;
  }
}
