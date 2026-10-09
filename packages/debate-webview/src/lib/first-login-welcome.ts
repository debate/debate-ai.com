/**
 * @fileoverview Once-per-browser flag for the first-sign-in welcome
 * notification (`components/layout/FirstLoginWelcomeProvider.tsx`).
 *
 * "First time login" is decided per browser, not per account: the
 * welcome outlines the app's key links, so the right moment to show
 * it is the first time this browser carries a signed-in session. A
 * reader who signs in on a new device still benefits from the tour,
 * and a reader who cleared storage gets it back — the same policy the
 * guest sign-in prompt's opt-out (`lib/sign-in-prompt-preference.ts`)
 * follows for its own state.
 *
 * Kept separate from the provider: the flag is plain storage
 * bookkeeping with no React and no `fetch`, so it stays testable
 * without a DOM, and the provider stays free of storage details.
 *
 * @module lib/first-login-welcome
 */

const STORAGE_KEY = "firstLoginWelcomeShown"

/**
 * Whether the first-sign-in welcome notification has already been
 * shown, on this browser.
 *
 * `false` on a server render, in a test with no `localStorage`, or
 * when the browser refuses storage — the welcome degrades to "show it
 * on every first authenticated load", never to "silently never show".
 */
export function wasFirstLoginWelcomeShown(): boolean {
  if (typeof localStorage === "undefined") return false
  try {
    return localStorage.getItem(STORAGE_KEY) === "true"
  } catch {
    return false
  }
}

/**
 * Records that the welcome notification was shown, so it is not
 * shown again on this browser.
 */
export function markFirstLoginWelcomeShown(): void {
  if (typeof localStorage === "undefined") return
  try {
    localStorage.setItem(STORAGE_KEY, "true")
  } catch {
    // A browser refusing local storage just can't remember; the
    // provider's own `open` state keeps it from stacking copies.
  }
}
