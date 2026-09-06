/**
 * @fileoverview Verifier guard for confirming a routed research task's
 * completion — closes the "No reviewer/verification step before a task is
 * marked complete; any visitor can mark any assignment done" Known gap
 * recorded in `docs/features/task-inbox.md` under the "🧭 Research Task
 * Routing" bullet in TODO.md. This repo has no auth/identity system, so —
 * mirroring `lib/peer-review.ts`'s identical self-review guard on
 * approve/reject/publish — a task's completion can be *marked* by anyone,
 * but only *verified* (credited toward completion history and the
 * leaderboard's completed-task count) by a different free-form contributor
 * id than the one it was assigned to.
 *
 * @module lib/task-verification
 */

import type { RoutedAssignment } from "debate-research-evidence/src/lib/research-task-routing";

/** Thrown when a verification action is attempted without a verifier id. */
export class VerifierIdRequiredError extends Error {
  constructor() {
    super("A verifier id is required to verify a completed task");
    this.name = "VerifierIdRequiredError";
  }
}

/** Thrown when a verifier id matches the assignment's own `contributorId` — no self-verification. */
export class SelfVerificationNotAllowedError extends Error {
  constructor(verifierId: string) {
    super(`Verifier "${verifierId}" cannot verify their own completed task`);
    this.name = "SelfVerificationNotAllowedError";
  }
}

/**
 * Guards a task-verification action: a verifier id is required, and it
 * can't match the assignment's own `contributorId` — compared
 * case-insensitively after trimming both sides, matching
 * `session-identity.ts`'s `isOwnContributorRow`/`deriveLockedVerifierId`
 * convention (so `Alice` can't self-verify a task assigned to `alice`).
 * Returns the trimmed verifier id on success; throws
 * `VerifierIdRequiredError` or `SelfVerificationNotAllowedError` otherwise.
 */
export function assertVerifierAllowed(assignment: RoutedAssignment, verifierId: string): string {
  const trimmed = verifierId.trim();
  if (!trimmed) {
    throw new VerifierIdRequiredError();
  }
  if (trimmed.toLowerCase() === assignment.contributorId.trim().toLowerCase()) {
    throw new SelfVerificationNotAllowedError(trimmed);
  }
  return trimmed;
}
