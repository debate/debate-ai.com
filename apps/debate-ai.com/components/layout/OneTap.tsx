"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { authClient, hasGoogleClientId } from "@/lib/auth/client";
import { useAuthProviders } from "@/lib/hooks/useAuthProviders";
import { useSession } from "@/lib/hooks/useSession";

/**
 * Google One Tap prompt.
 *
 * The Google client id is a Worker secret, so it is not in the browser bundle —
 * `useAuthProviders` fetches it from /api/auth/providers, which also says
 * whether this deployment has Google configured at all. Prompting without a
 * client id makes Google Identity Services fail on every page load.
 */
export function OneTap() {
  const { isAuthenticated, isLoading } = useSession();
  const { providers, isLoading: providersLoading } = useAuthProviders();
  const pathname = usePathname();
  const prompted = useRef(false);

  const googleReady =
    !providersLoading && providers.includes("google") && hasGoogleClientId();

  useEffect(() => {
    // The login screen has its own Google button; a prompt on top of it competes
    // with the choice the user is already making.
    if (isLoading || isAuthenticated || !googleReady || pathname === "/login") return;

    // Once per page load. Google throttles callers that re-prompt after a
    // dismissal, so firing again on every client-side navigation buys nothing
    // but a console full of suppressed-prompt warnings.
    if (prompted.current) return;
    prompted.current = true;

    authClient.oneTap({ callbackURL: pathname }).catch((error: unknown) => {
      console.error("[one-tap] prompt failed:", error);
      // Let a later navigation try again — this failure was not a dismissal.
      prompted.current = false;
    });
  }, [isLoading, isAuthenticated, googleReady, pathname]);

  return null;
}
