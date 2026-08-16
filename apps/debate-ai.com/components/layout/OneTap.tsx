"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { authClient, hasGoogleClientId, setGoogleClientId } from "@/lib/auth/client";
import { useSession } from "@/lib/hooks/useSession";

/**
 * Google One Tap prompt.
 *
 * The Google client id is a Worker secret, so it is not in the browser bundle —
 * it is fetched from /api/auth/providers, which also tells us whether this
 * deployment has Google configured at all. Prompting without a client id (the
 * previous behaviour) made Google Identity Services fail on every page load.
 */
export function OneTap() {
  const { isAuthenticated, isLoading } = useSession();
  const pathname = usePathname();
  const [googleReady, setGoogleReady] = useState(hasGoogleClientId());

  useEffect(() => {
    if (googleReady) return;

    let cancelled = false;
    fetch("/api/auth/providers")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled || !data?.providers?.includes("google")) return;
        setGoogleClientId(data.googleClientId ?? "");
        if (hasGoogleClientId()) setGoogleReady(true);
      })
      .catch(() => {
        /* One Tap is optional — the login page still offers every other path. */
      });

    return () => {
      cancelled = true;
    };
  }, [googleReady]);

  useEffect(() => {
    // The login page has its own Google button; a prompt on top of it competes
    // with the user's explicit choice.
    if (isLoading || isAuthenticated || !googleReady || pathname === "/login") return;

    authClient.oneTap({ callbackURL: pathname }).catch((error: unknown) => {
      console.error("[one-tap] prompt failed:", error);
    });
  }, [isLoading, isAuthenticated, googleReady, pathname]);

  return null;
}
