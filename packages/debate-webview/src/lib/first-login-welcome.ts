/**
 * @fileoverview The "already shown" flag for the first-sign-in welcome
 * notification (`components/layout/FirstLoginWelcomeProvider.tsx`).
 *
 * The welcome shows once per account: the source of truth is
 * `user_settings.welcome_dismissed_at`, read and written through
 * `/api/settings/welcome`, so dismissing it on one device keeps it from
 * appearing on any other. A `localStorage` copy of the flag sits in
 * front of that as a cache, so a browser that has already shown (or
 * learned about) the dismissal never pays the request again.
 *
 * Kept separate from the provider: the flag is plain storage and
 * `fetch` bookkeeping with no React, so it stays testable without a
 * DOM, and the provider stays free of storage details.
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

const SYNCED_KEY = "firstLoginWelcomeSynced"

/**
 * Whether this browser has confirmed the account carries the
 * dismissal, so a browser that showed the welcome before the flag
 * moved to the account records it there exactly once.
 */
export function wasFirstLoginWelcomeSynced(): boolean {
  if (typeof localStorage === "undefined") return false
  try {
    return localStorage.getItem(SYNCED_KEY) === "true"
  } catch {
    return false
  }
}

/** Records that the account carries the dismissal. */
export function markFirstLoginWelcomeSynced(): void {
  if (typeof localStorage === "undefined") return
  try {
    localStorage.setItem(SYNCED_KEY, "true")
  } catch {
    // Without storage the sync just repeats next load; it is idempotent.
  }
}

/** The account flag's route (`apps/debate-ai.com/app/api/settings/welcome`). */
const WELCOME_ENDPOINT = "/api/settings/welcome"

/**
 * Whether the signed-in account has already seen the welcome, from
 * `user_settings.welcome_dismissed_at`.
 *
 * `null` when the answer is unknown — signed out, a failed request, or
 * no `fetch` — so the caller can choose to stay quiet rather than show
 * the welcome to an account that may already have dismissed it.
 */
export async function fetchFirstLoginWelcomeDismissed(
  endpoint = WELCOME_ENDPOINT,
): Promise<boolean | null> {
  if (typeof fetch === "undefined") return null
  try {
    const res = await fetch(endpoint, { credentials: "same-origin" })
    if (!res.ok) return null
    const body = (await res.json()) as { dismissed?: unknown }
    return typeof body.dismissed === "boolean" ? body.dismissed : null
  } catch {
    return null
  }
}

/**
 * Records on the account that the welcome was shown, so no browser
 * shows it again. Best-effort: a failure is swallowed, and the
 * per-browser flag above still keeps this browser from repeating it.
 *
 * @returns Whether the account accepted the write.
 */
export async function saveFirstLoginWelcomeDismissed(
  endpoint = WELCOME_ENDPOINT,
): Promise<boolean> {
  if (typeof fetch === "undefined") return false
  try {
    const res = await fetch(endpoint, { method: "POST", credentials: "same-origin" })
    return res.ok
  } catch {
    // Offline or signed out mid-request: the local flag still holds.
    return false
  }
}
