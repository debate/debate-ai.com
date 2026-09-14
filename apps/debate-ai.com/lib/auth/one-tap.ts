/**
 * @fileoverview Google One Tap settings, and how to read the outcome Google
 * reports back — the parts that decide whether the prompt can sign anyone in.
 *
 * Kept out of `./client` (which is `"use client"` and pulls in React) and out
 * of the component, so `lib/auth/__tests__/one-tap.test.ts` can assert on the
 * real values rather than a copy — the same reason `./oauth-state` exists.
 *
 * ## Why this file is careful about FedCM
 *
 * Google One Tap used to run as a Google-controlled iframe whose prompt the
 * page could inspect and steer. That flow is gone: Google's FedCM migration
 * had a transition period that **ended in August 2025**, after which the
 * browser's Federated Credential Management API is the only implementation and
 * `use_fedcm_for_prompt: false` is ignored. better-auth's own One Tap docs say
 * the same thing — "FedCM itself is managed by the Google Identity Services
 * library and cannot be disabled" — and its client plugin exposes no way to
 * turn it off, only `promptOptions.fedCM` for the sign-out side.
 *
 * Two things follow, and both used to be wrong here:
 *
 *  1. Passing `use_fedcm_for_prompt: false` is not a no-op. Google Identity
 *     Services logs it as a deprecated setting and runs FedCM anyway, so the
 *     app was configured for a flow that no longer exists.
 *  2. Under FedCM the prompt is `navigator.credentials.get()`, and the browser
 *     allows **one** federated request at a time. better-auth's client retries
 *     `google.accounts.id.prompt()` up to five times with exponential backoff
 *     whenever a moment comes back with a reason it does not recognise — and
 *     under FedCM the reasons it looks for are gone (see
 *     {@link describeOneTapMoment}), so it retries on outcomes that are
 *     actually final. Each retry issues a second `get()` on top of the one
 *     still pending, which the browser rejects with `InvalidStateError`.
 *
 * @see https://developers.google.com/identity/gsi/web/guides/fedcm-migration
 */

/**
 * Options for better-auth's `oneTapClient`, minus the client id (a Worker
 * secret fetched at runtime — see `lib/hooks/useAuthProviders`).
 *
 * `promptOptions.maxAttempts: 0` turns off the plugin's internal retry loop.
 * It is not "never retry": it is "the component decides", and
 * `components/layout/OneTap.tsx` already re-prompts on a later navigation when
 * the outcome was not final. Leaving the plugin's loop on stacks a second
 * FedCM request onto a live one, which is the `InvalidStateError` above.
 *
 * `additionalOptions` deliberately carries no `use_fedcm_for_prompt`: the
 * plugin spreads it last, so anything set there overrides better-auth's own
 * FedCM handling, and the only value that could be set is one Google no longer
 * honours.
 */
export const ONE_TAP_CLIENT_OPTIONS = {
  promptOptions: {
    maxAttempts: 0,
  },
} as const;

/**
 * How Google described a prompt that did not sign the visitor in, and whether
 * it is worth trying again on a later page.
 *
 * FedCM removed most of what this used to read. Per Google's migration guide,
 * `isDisplayMoment()`, `isDisplayed()`, `isNotDisplayed()` and
 * `getNotDisplayedReason()` are no longer reported at all, and
 * `isSkippedMoment()` still fires but `getSkippedReason()` no longer says why.
 * Only the dismissed moment still carries a usable reason. So an outcome with
 * no reason is the normal case now, not a surprise — and it has to be read as
 * final, because re-prompting a visitor Google has already decided not to
 * prompt burns the suppression cooldown for nothing.
 */
export interface OneTapMoment {
  isSkippedMoment?: () => boolean;
  getSkippedReason?: () => string | undefined;
  isDismissedMoment?: () => boolean;
  getDismissedReason?: () => string | undefined;
  isNotDisplayed?: () => boolean;
  getNotDisplayedReason?: () => string | undefined;
}

/**
 * Dismissal reasons that leave the prompt genuinely re-showable on the next
 * page — the flow restarted underneath us, or Google could not mint a
 * credential this time. Everything else (the visitor closing the prompt, a
 * credential actually returned, or no reason at all) is settled.
 */
const RETRYABLE_DISMISS_REASONS = new Set(["flow_restarted", "issuing_failed"]);

/** The outcome of one prompt: Google's reason, if any, and what to do next. */
export interface OneTapOutcome {
  /** Google's own reason string, or `undefined` — normal under FedCM. */
  reason?: string;
  /** Whether prompting again on a later navigation could still succeed. */
  retryable: boolean;
}

/** Read a `PromptMomentNotification` the way FedCM actually reports them. */
export function describeOneTapMoment(moment?: OneTapMoment): OneTapOutcome {
  const reason = moment?.isDismissedMoment?.()
    ? moment.getDismissedReason?.()
    : // Skipped moments still fire under FedCM but carry no reason, and
      // display moments are not reported at all. Both are read as final.
      undefined;

  return { reason, retryable: Boolean(reason && RETRYABLE_DISMISS_REASONS.has(reason)) };
}

/**
 * Rejections that mean "not this time" rather than "this app is misconfigured".
 *
 * Google's script already logs these itself (`[GSI_LOGGER]`), so re-reporting
 * them as `console.error` would be alarming, redundant noise on every affected
 * page load. `IdentityCredentialError` is deliberately *not* here: it is FedCM
 * saying it could not retrieve a token for this client id, which is a real
 * configuration problem worth seeing.
 */
const BENIGN_ONE_TAP_ERROR_NAMES = new Set([
  // The browser aborted a stale FedCM request, typically on navigation.
  "AbortError",
  // FedCM or third-party sign-in is off in the browser's own site settings.
  "NetworkError",
  // The visitor (or the browser) declined the federated prompt.
  "NotAllowedError",
  // A federated request was already in flight. `maxAttempts: 0` above is what
  // stops us causing this; it can still arrive from another tab or extension.
  "InvalidStateError",
]);

/** Whether a One Tap rejection is expected enough to log quietly. */
export function isBenignOneTapError(error: unknown): boolean {
  return error instanceof Error && BENIGN_ONE_TAP_ERROR_NAMES.has(error.name);
}
