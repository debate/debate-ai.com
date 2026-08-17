"use client";

import { useEffect, useState } from "react";
import { authClient } from "@/lib/auth/client";
import { useSession } from "@/lib/hooks/useSession";
import { NEXT_PUBLIC_GOOGLE_CLIENT_ID } from "@/lib/config/site";

export function OneTap() {
  const { isAuthenticated, isLoading } = useSession();

  // Google One Tap should only be prompted once the backend actually has the
  // Google provider configured — otherwise the prompt can only fail, since
  // there is no provider to complete the sign-in against.
  const [googleConfigured, setGoogleConfigured] = useState(false);

  useEffect(() => {
    if (!NEXT_PUBLIC_GOOGLE_CLIENT_ID) return;

    let active = true;
    fetch("/api/auth/providers")
      .then((res) => res.json())
      .then((data: { providers?: string[] }) => {
        if (active) setGoogleConfigured(!!data.providers?.includes("google"));
      })
      .catch(() => {
        if (active) setGoogleConfigured(false);
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (isLoading || isAuthenticated || !googleConfigured) return;

    // A dismissed or suppressed prompt rejects; that is routine (the user
    // closed it, or Google is rate-limiting after repeated dismissals) and
    // must not surface as an unhandled rejection.
    void Promise.resolve(authClient.oneTap()).catch((error) => {
      console.debug("[auth] Google One Tap unavailable:", error);
    });
  }, [isLoading, isAuthenticated, googleConfigured]);

  return null;
}
