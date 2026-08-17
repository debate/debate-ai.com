"use client";

/**
 * @fileoverview Runtime lookup of the OAuth providers this deployment can
 * actually complete a sign-in with.
 *
 * OAuth credentials live in Worker secrets, so the browser bundle cannot know
 * which providers exist — `/api/auth/providers` answers that, and hands back
 * the public Google client id One Tap needs. Every caller shares one in-flight
 * request: the login screen, the login dialog and the One Tap prompt can all
 * mount at once, and three copies of the same answer is wasted latency.
 */

import { useEffect, useState } from "react";
import { setGoogleClientId } from "../auth/client";

export interface AuthProviders {
  /** Provider ids with usable credentials, e.g. `["google", "discord"]`. */
  providers: string[];
  /** Public Google client id, or `""` when Google is not configured. */
  googleClientId: string;
}

const NONE: AuthProviders = { providers: [], googleClientId: "" };

/** In-flight (or settled) request shared by every caller on the page. */
let pending: Promise<AuthProviders> | null = null;

/**
 * Resolve the configured providers, reusing the request across callers.
 * A failed lookup is not cached, so a later mount can retry.
 */
export function fetchAuthProviders(): Promise<AuthProviders> {
  if (!pending) {
    pending = fetch("/api/auth/providers")
      .then((res) => (res.ok ? res.json() : null))
      .then((data): AuthProviders => {
        const resolved: AuthProviders = {
          providers: Array.isArray(data?.providers) ? data.providers : [],
          googleClientId:
            typeof data?.googleClientId === "string" ? data.googleClientId : "",
        };
        // The One Tap plugin reads the client id when the prompt fires, so
        // handing it over here is enough for a later prompt to work.
        setGoogleClientId(resolved.googleClientId);
        return resolved;
      })
      .catch((error) => {
        console.error("[auth] failed to load providers:", error);
        pending = null;
        return NONE;
      });
  }
  return pending;
}

/** React binding over {@link fetchAuthProviders}. */
export function useAuthProviders() {
  const [resolved, setResolved] = useState<AuthProviders>(NONE);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetchAuthProviders().then((value) => {
      if (cancelled) return;
      setResolved(value);
      setIsLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return {
    ...resolved,
    isLoading,
    /** Whether any social provider is available at all. */
    hasSocialProviders: resolved.providers.length > 0,
  };
}
