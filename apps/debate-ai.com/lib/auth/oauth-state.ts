/**
 * @fileoverview The two settings that decide whether an OAuth sign-in survives
 * the round trip through the provider — and where the visitor ends up when it
 * does not.
 *
 * Kept out of `./index` so the tests can hold the real values rather than a
 * copy: building the auth instance needs a D1 binding, and these are what
 * `lib/auth/__tests__/oauth-state.test.ts` exercises.
 */

/**
 * How long the signed `state` cookie better-auth sets at sign-in stays valid,
 * in seconds.
 *
 * better-auth checks the OAuth `state` twice when the provider redirects back:
 * against the row it wrote to the database, which it gives ten minutes, and
 * against this cookie, which it gives five by default. The two disagreeing
 * means a sign-in that takes between five and ten minutes — a fresh Google
 * account, a password manager, two-factor, a consent screen actually read
 * rather than skipped — arrives with the state still valid and the cookie
 * already gone, and is rejected as `state_mismatch`, a CSRF failure, rather
 * than as the expiry it really is. Matching the cookie to the state's own
 * lifetime closes that window without widening how long a state is accepted.
 */
export const OAUTH_STATE_COOKIE_MAX_AGE_SECONDS = 600;

/**
 * Where a failed OAuth callback lands.
 *
 * Without this better-auth serves its own built-in page at `/api/auth/error` —
 * a dead end that shows a raw code ("CODE: state_mismatch") and offers nothing
 * but "Go Home", so a sign-in that failed for a recoverable reason looks like
 * the site is broken. `/login` reads the `error` query parameter (see
 * `./sign-in-errors`) and already has the buttons to try again.
 *
 * Relative on purpose: the redirect resolves against whichever domain the
 * visitor is actually on, the same way the rest of this app's auth config
 * follows the request's host rather than pinning one origin.
 */
export const SIGN_IN_ERROR_URL = "/login";
