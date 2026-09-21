/**
 * @fileoverview The 30-minute per-feature cooldown for the guest sign-in
 * prompt (`components/layout/SignInPromptProvider.tsx`).
 *
 * Favouriting is a rapid, repeated action — a debater working through a
 * results page favourites a dozen rounds in a row — so the provider only
 * raises one dialog per feature per cooldown window rather than one per
 * click. That state used to live inline in the provider, backed by
 * `sessionStorage`. `sessionStorage` is per-tab, not per-browser, so a guest
 * who dismissed the dialog and then opened a second tab (or followed a link
 * that opened one) was asked again immediately — the cooldown was reset by
 * the one action, opening a tab, that has nothing to do with whether 30
 * minutes have passed. Moving the same bookkeeping to `localStorage`, which
 * is shared across a browser's tabs, is what closes that gap; the 30-minute
 * window itself is unchanged, and still expires and re-prompts exactly as
 * before. See `packages/debate-help-docs/content/docs/internals/tool-data-sync.mdx`'s
 * Known gaps.
 *
 * Kept separate from `lib/sign-in-prompt-preference.ts`: that module is the
 * permanent, explicit "don't ask me again" opt-out a guest reaches for a
 * secondary action, while this is the passive rate limit applied whether or
 * not they've made that choice. Also kept separate from
 * `debate-data-sync/src/state/sign-in-prompt.ts`: that module is the
 * framework-free bus a tool raises a prompt on, and has no opinion on
 * whether the app should actually show one — the cooldown, like the opt-out,
 * is display policy the provider applies.
 *
 * @module lib/sign-in-prompt-cooldown
 */

/**
 * How long to wait before prompting the same feature again, in ms.
 *
 * One prompt per feature per cooldown window is the offer; after that the
 * guest has been told, and their saves go on working locally.
 */
export const PROMPT_COOLDOWN_MS = 30 * 60 * 1000

const STORAGE_KEY = "signInPromptsShownAt"

function readShownAt(): Record<string, number> {
  if (typeof localStorage === "undefined") return {}
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    const parsed: unknown = raw ? JSON.parse(raw) : {}
    return typeof parsed === "object" && parsed !== null ? (parsed as Record<string, number>) : {}
  } catch {
    return {}
  }
}

/**
 * Whether `feature` was already prompted within the last
 * {@link PROMPT_COOLDOWN_MS}, on this browser.
 *
 * `false` on a server render, in a test with no `localStorage`, or when the
 * browser refuses storage — the prompt degrades to "ask every time it would
 * otherwise", never to "silently never ask again".
 *
 * @param feature - The feature name a prompt would be raised for.
 * @param now - The current time, in ms. Defaults to `Date.now()`; a test
 *   passes an explicit value to check the cooldown boundary without a timer.
 */
export function wasSignInPromptShownRecently(feature: string, now: number = Date.now()): boolean {
  const shownAt = readShownAt()[feature]
  return typeof shownAt === "number" && now - shownAt < PROMPT_COOLDOWN_MS
}

/**
 * Records that `feature`'s prompt was just shown, starting its cooldown.
 *
 * @param feature - The feature name the prompt was raised for.
 * @param now - The current time, in ms. Defaults to `Date.now()`.
 */
export function markSignInPromptShown(feature: string, now: number = Date.now()): void {
  if (typeof localStorage === "undefined") return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...readShownAt(), [feature]: now }))
  } catch {
    // A browser refusing local storage prompts once per click instead of
    // once per cooldown window — chattier, never wrong.
  }
}
