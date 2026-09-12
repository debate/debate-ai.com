/**
 * @fileoverview Persistent, cross-tab "don't ask me again" opt-out for the
 * guest sign-in prompt (`components/layout/SignInPromptProvider.tsx`).
 *
 * The provider already rate-limits a single feature's prompt to once per
 * 30 minutes, but that cooldown lives in `sessionStorage` — a guest who
 * declines and then opens a new tab (or the same tab a day later) is asked
 * again. This is the explicit, permanent opt-out for a guest who has made up
 * their mind: "these tools save to this browser only" is fine with them, and
 * they don't want to be asked again. It closes the "no 'don't ask me again'
 * that persists" Known gap recorded in
 * `packages/debate-help-docs/content/docs/internals/tool-data-sync.mdx`.
 *
 * Kept separate from `debate-data-sync/src/state/sign-in-prompt.ts`: that
 * module is the framework-free bus a tool raises a prompt on, and it has no
 * opinion on whether the app should actually show one — the cooldown and this
 * opt-out are both display policy the provider applies, not the bus.
 *
 * @module lib/sign-in-prompt-preference
 */

const STORAGE_KEY = "signInPromptsOptedOut"

/**
 * Whether a guest has asked not to see the sign-in prompt again, on this
 * browser. `false` on a server render, in a test with no `localStorage`, or
 * when the browser refuses storage — the prompt degrades to "ask every time
 * it would otherwise", never to "silently ask never".
 */
export function isSignInPromptOptedOut(): boolean {
  if (typeof localStorage === "undefined") return false
  try {
    return localStorage.getItem(STORAGE_KEY) === "true"
  } catch {
    return false
  }
}

/**
 * Sets or clears the opt-out.
 *
 * @param optedOut - `true` to stop showing the prompt on this browser, `false`
 *   to go back to being asked (subject to the provider's own cooldown).
 */
export function setSignInPromptOptedOut(optedOut: boolean): void {
  if (typeof localStorage === "undefined") return
  try {
    if (optedOut) localStorage.setItem(STORAGE_KEY, "true")
    else localStorage.removeItem(STORAGE_KEY)
  } catch {
    // A browser refusing local storage just can't remember the choice; the
    // prompt keeps working, only without the "stop asking me" persisting.
  }
}
