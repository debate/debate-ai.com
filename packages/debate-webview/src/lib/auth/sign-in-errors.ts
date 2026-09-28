/**
 * @fileoverview Human wording for the `?error=` code better-auth puts on the
 * URL when an OAuth sign-in fails.
 *
 * better-auth reports these as machine-readable slugs and, left to itself,
 * renders them on its own built-in page at `/api/auth/error` — a dead end that
 * shows the raw code and a "Go Home" button. `onAPIError.errorURL` in
 * `./index.ts` sends them to `/login` instead, and this is what that page says
 * about them.
 *
 * Kept as a plain function so the mapping can be unit tested without rendering
 * the page.
 */

/** Codes better-auth redirects with that deserve their own explanation. */
const MESSAGES: Record<string, string> = {
  // The state row or its signed cookie was missing when the provider sent the
  // browser back: the sign-in was left open too long, the tab was restored
  // from history, or the callback was opened a second time. Retrying works.
  state_mismatch: "That sign-in attempt expired or was already used. Please try again.",
  state_expired: "That sign-in attempt expired. Please try again.",
  state_not_found: "That sign-in attempt expired or was already used. Please try again.",
  state_invalid: "That sign-in attempt could not be verified. Please try again.",
  please_restart_the_process: "Something interrupted the sign-in. Please try again.",
  // The provider redirected back without a code, or with one it then refused.
  no_code: "The sign-in provider did not complete the request. Please try again.",
  invalid_code: "The sign-in provider rejected the request. Please try again.",
  // Account-shape problems, where retrying the same provider will not help.
  email_not_found: "That account did not share an email address, so we could not sign you in.",
  email_not_verified: "Please verify your email address with that provider, then sign in again.",
  account_already_linked_to_different_user:
    "That account is already linked to a different profile here. Sign in with the provider you used originally.",
  unable_to_link_account: "We could not link that account. Please try a different sign-in method.",
  signup_disabled: "Sign-ups are closed for this deployment.",
};

/** Fallback for a code we have no specific wording for. */
const GENERIC = "Sign-in did not complete. Please try again.";

/**
 * What to tell someone about `code`, or `null` when there is nothing to say —
 * no code on the URL, or an empty one.
 *
 * The code reaches us from the query string, so it is untrusted input: only
 * codes in the table above are ever echoed, and everything else falls back to
 * the generic wording rather than being rendered.
 */
export function describeSignInError(code: string | null | undefined): string | null {
  if (!code) return null;
  return MESSAGES[code] ?? GENERIC;
}
