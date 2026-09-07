"use client";

import { useEffect, useMemo, useRef } from "react";
import { usePathname } from "next/navigation";
import { createAppAuthClient } from "@/lib/auth/client";
import { useAuthProviders } from "@/lib/hooks/useAuthProviders";
import { useSession } from "@/lib/hooks/useSession";
import { debugLog } from "@/lib/debug-log";

/**
 * Skipped-prompt reasons worth another try on the next page.
 *
 * Everything else — the user closing the prompt, a returned credential, or any
 * `isNotDisplayed` reason (no Google session, unregistered origin, a
 * suppression cooldown) — is settled for this page load, so re-prompting on
 * every navigation would only spend requests on a prompt that cannot appear.
 */
const RETRYABLE_SKIP_REASONS = new Set([
  "auto_cancel",
  "tap_outside",
  "issuing_failed",
]);

/**
 * Names of rejections Google's identity script throws for outcomes outside
 * our control — the browser aborting a stale FedCM request on navigation, or
 * FedCM/third-party sign-in being disabled in the browser's own site
 * settings — rather than an application bug. Google's script already logs
 * these itself (`[GSI_LOGGER]`), so re-logging them as `console.error` here
 * would just be alarming, redundant noise on every affected page load.
 */
const BENIGN_ONE_TAP_ERROR_NAMES = new Set(["AbortError", "NetworkError"]);

/**
 * The subset of Google's `PromptMomentNotification` this file reads. The
 * one-tap plugin hands the notification through untyped.
 */
interface PromptNotification {
  isSkippedMoment?: () => boolean;
  getSkippedReason?: () => string | undefined;
  isDismissedMoment?: () => boolean;
  getDismissedReason?: () => string | undefined;
  isNotDisplayed?: () => boolean;
  getNotDisplayedReason?: () => string | undefined;
}

/** The reason Google gives for a prompt that did not sign the user in. */
function promptReason(notification?: PromptNotification): string | undefined {
  if (notification?.isSkippedMoment?.())
    return notification.getSkippedReason?.();
  if (notification?.isDismissedMoment?.())
    return notification.getDismissedReason?.();
  if (notification?.isNotDisplayed?.())
    return notification.getNotDisplayedReason?.();
  return undefined;
}

/**
 * Google One Tap prompt, mounted in the root layout so every page of the app
 * offers a signed-out visitor a one-tap sign-in — the login screen included,
 * where the prompt sits alongside the form's own Google button.
 *
 * The Google client id is a Worker secret, so it is not in the browser bundle —
 * `useAuthProviders` fetches it from /api/auth/providers, which also says
 * whether this deployment has Google configured at all. Prompting without a
 * client id makes Google Identity Services fail on every page load.
 */
export function OneTap() {
  const { isAuthenticated, isLoading } = useSession();
  const {
    providers,
    googleClientId,
    isLoading: providersLoading,
  } = useAuthProviders();
  const pathname = usePathname();
  /** Path of the most recent prompt, so one navigation prompts once. */
  const promptedPath = useRef<string | null>(null);
  /** A prompt is on screen (or still retrying); a second call would be a no-op. */
  const inFlight = useRef(false);
  /** Google has settled this page load — stop asking until the next reload. */
  const settled = useRef(false);

  const googleReady =
    !providersLoading &&
    providers.includes("google") &&
    Boolean(googleClientId);
  const oneTapAuthClient = useMemo(
    () => createAppAuthClient(googleClientId),
    [googleClientId],
  );

  debugLog("[one-tap] state:", {
    pathname,
    isLoading,
    isAuthenticated,
    providersLoading,
    providers,
    hasGoogleClientId: Boolean(googleClientId),
    googleReady,
  });

  useEffect(() => {
    if (isLoading || isAuthenticated || !googleReady) {
      debugLog("[one-tap] effect skipped:", {
        isLoading,
        isAuthenticated,
        googleReady,
      });
      return;
    }

    // A displayed prompt survives client-side navigation, and the one-tap
    // plugin refuses overlapping calls, so only prompt when the last one is
    // done and this navigation has not been prompted for yet.
    if (
      settled.current ||
      inFlight.current ||
      promptedPath.current === pathname
    ) {
      debugLog(
        "[one-tap] effect skipped (settled/in-flight/already prompted):",
        {
          settled: settled.current,
          inFlight: inFlight.current,
          promptedPath: promptedPath.current,
          pathname,
        },
      );
      return;
    }
    promptedPath.current = pathname;
    inFlight.current = true;

    debugLog("[one-tap] calling authClient.oneTap for", pathname);

    oneTapAuthClient
      .oneTap({
        callbackURL: pathname,
        onPromptNotification: (notification?: PromptNotification) => {
          // Only fires when the prompt did not produce a sign-in. Google
          // throttles callers that re-prompt after a dismissal, so a settled
          // outcome ends the prompting for this page load.
          const reason = promptReason(notification);
          debugLog("[one-tap] prompt notification:", {
            reason,
            notification,
          });
          if (!reason || !RETRYABLE_SKIP_REASONS.has(reason))
            settled.current = true;
        },
      })
      .then(() => {
        debugLog(
          "[one-tap] oneTap() call resolved (prompt shown or handled)",
        );
      })
      .catch((error: unknown) => {
        const isBenign =
          error instanceof Error && BENIGN_ONE_TAP_ERROR_NAMES.has(error.name);
        if (isBenign) {
          debugLog("[one-tap] prompt failed (expected):", error);
        } else {
          console.error("[one-tap] prompt failed:", error);
        }
        // Let a later navigation try again — this failure was not a dismissal.
        promptedPath.current = null;
      })
      .finally(() => {
        inFlight.current = false;
      });
  }, [isLoading, isAuthenticated, googleReady, pathname, oneTapAuthClient]);

  return null;
}
