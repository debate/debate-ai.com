/**
 * @fileoverview Deriving a contributor id from a real signed-in identity.
 *
 * Every free-form "my id" field across this package's panels — Task Inbox's
 * "My tasks" filter is the first one wired to this — exists only because
 * this repo had no auth/identity system when those panels were built. It
 * now does (better-auth, wired in `apps/debate-ai.com/lib/auth`), so a
 * caller with a real signed-in user can prefill that field instead of
 * making a contributor retype an id they already typed once at sign-in.
 *
 * This stays a *prefill*, not a login: the derived value is only a starting
 * point for the same free-form text field, so a contributor can still
 * override it — e.g. to look up a teammate's tasks, or because their
 * account's display name isn't the contributor id their tasks were routed
 * under.
 *
 * @module lib/session-identity
 */

/** The subset of a signed-in session's user record this module needs. */
export interface SessionIdentity {
  id?: string | null;
  name?: string | null;
  email?: string | null;
}

/**
 * Derives a contributor id to prefill a free-form "my id" field with: the
 * signed-in user's display name, falling back to their email's local part,
 * falling back to their raw account id. Returns "" when `identity` is
 * null/undefined or carries no usable field.
 */
export function deriveContributorIdFromSessionIdentity(
  identity: SessionIdentity | null | undefined,
): string {
  if (!identity) return "";

  const name = identity.name?.trim();
  if (name) return name;

  const email = identity.email?.trim();
  if (email) {
    const localPart = email.split("@")[0]?.trim();
    if (localPart) return localPart;
  }

  const id = identity.id?.trim();
  if (id) return id;

  return "";
}

/**
 * Whether a roster row's contributor id belongs to the signed-in visitor,
 * for highlighting "your" row in an all-contributors roster (Leaderboard,
 * Progress Unlocks, Research Progress) without filtering anyone else out.
 * Case-insensitive and trims both sides; returns `false` when either side
 * is blank so a signed-out visitor never highlights anything.
 */
export function isOwnContributorRow(
  contributorId: string,
  signedInContributorId: string | null | undefined,
): boolean {
  const signedIn = signedInContributorId?.trim();
  if (!signedIn) return false;

  return contributorId.trim().toLowerCase() === signedIn.toLowerCase();
}

/**
 * Derives the id a "who is performing this action" field (e.g. a task
 * verifier id) should be *locked* to for a signed-in visitor, turning the
 * usual prefill-only pattern into a real gate for actions where letting a
 * visitor type someone else's id would matter (crediting a verification,
 * endorsing a contribution, etc.).
 *
 * Returns "" (no lock — leave the field free-form) when signed out, or
 * when `ownerContributorId` already belongs to the signed-in visitor (the
 * action is a self-action, e.g. verifying your own completed task, and
 * should be disabled outright rather than locked to a value that would
 * just fail the underlying guard). Otherwise returns the trimmed
 * signed-in id to lock the field to.
 */
export function deriveLockedVerifierId(
  ownerContributorId: string,
  signedInContributorId: string | null | undefined,
): string {
  const signedIn = signedInContributorId?.trim();
  if (!signedIn) return "";
  if (isOwnContributorRow(ownerContributorId, signedIn)) return "";

  return signedIn;
}
