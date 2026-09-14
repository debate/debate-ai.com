"use client";

import { useEffect, useMemo, useRef } from "react";
import { usePathname } from "next/navigation";
import { createAppAuthClient } from "@/lib/auth/client";
import {
  describeOneTapMoment,
  isBenignOneTapError,
  type OneTapMoment,
} from "@/lib/auth/one-tap";
import { useAuthProviders } from "@/lib/hooks/useAuthProviders";
import { useSession } from "@/lib/hooks/useSession";
import { debugLog } from "@/lib/debug-log";

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
        // Google hands back a verified id token; the sign-in itself happens at
        // POST /api/auth/one-tap/callback. The plugin checks that response for
        // an error and then returns without telling anyone, so a prompt the
        // visitor completed and a sign-in the server rejected are
        // indistinguishable from out here. Ask to see the rejection.
        fetchOptions: {
          onError: ({ error, response }) => {
            console.error("[one-tap] sign-in rejected by the server:", {
              status: response?.status,
              code: error?.code,
              message: error?.message,
            });
            // The credential was spent; only a fresh prompt can retry.
            settled.current = true;
          },
        },
        onPromptNotification: (notification?: OneTapMoment) => {
          // Only fires when the prompt did not produce a sign-in. Google
          // throttles callers that re-prompt after a dismissal, so a settled
          // outcome ends the prompting for this page load. Under FedCM most
          // outcomes arrive with no reason at all — see lib/auth/one-tap.
          const { reason, retryable } = describeOneTapMoment(notification);
          debugLog("[one-tap] prompt notification:", {
            reason,
            retryable,
            notification,
          });
          if (!retryable) settled.current = true;
        },
      })
      .then(() => {
        debugLog(
          "[one-tap] oneTap() call resolved (prompt shown or handled)",
        );
      })
      .catch((error: unknown) => {
        if (isBenignOneTapError(error)) {
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
