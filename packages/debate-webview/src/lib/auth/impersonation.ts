"use client";

import { authClient } from "./client";

/**
 * Admin impersonation (better-auth's `admin` plugin; the server rules are in
 * apps/debate-web/lib/auth/impersonation.ts). Both calls swap the session
 * cookie, so each ends with a full page load: every provider in the shell then
 * starts over under the account now signed in.
 */

/** Signs in as `userId` (a user id, not an email) and reloads at `/`. */
export async function impersonateUser(userId: string, redirectTo = "/"): Promise<void> {
  const { error } = await authClient.admin.impersonateUser({ userId });
  if (error) throw new Error(error.message ?? "Failed to impersonate user");
  window.location.assign(redirectTo);
}

/** Ends the impersonated session and returns to the admin's own, at /admin. */
export async function stopImpersonating(redirectTo = "/admin"): Promise<void> {
  const { error } = await authClient.admin.stopImpersonating();
  if (error) throw new Error(error.message ?? "Failed to stop impersonating");
  window.location.assign(redirectTo);
}

/** The admin's user id when the current session is an impersonation, else null. */
export function impersonatedByOf(session: unknown): string | null {
  const value = (session as { session?: { impersonatedBy?: unknown } } | null | undefined)?.session
    ?.impersonatedBy;
  return typeof value === "string" && value ? value : null;
}
