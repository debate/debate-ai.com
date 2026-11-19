/**
 * @fileoverview The Tabroom account this site signs its Tabroom requests in as.
 *
 * Tabroom answers many reads only for signed-in users (paradigms, judging
 * records, and increasingly its API and classic pages in general). Every
 * server-side request to tabroom.com from the Worker goes through
 * {@link tabroomFetch}, which adds the site account's session cookie,
 * `TabroomToken=<value>`.
 *
 * The value comes from the `TABROOM_API_KEY` secret: the `TabroomToken`
 * cookie copied from a browser signed in at tabroom.com, raw (`$6$…`) or
 * URL-encoded as the browser stores it (`%246%24…`). `TABROOM_SESSION_TOKEN`
 * is still read as a fallback for existing deployments. Set
 * `TABROOM_COOKIE_NAME` if Tabroom ever renames the cookie. Unset, requests
 * go out signed out and paradigm reads answer "unauthorized".
 *
 * @module lib/judge-paradigms/tabroom
 */

import { tabroomCookie, type TabroomCredentials } from "@debate-ai/tournaments/server";
import { getEnv } from "@/lib/env";

/** The env vars the Tabroom session is read from, first match wins. */
export const TABROOM_TOKEN_ENV = ["TABROOM_API_KEY", "TABROOM_SESSION_TOKEN"] as const;

/** The Tabroom session the site signs in as, from `TABROOM_API_KEY`; `null` when unset. */
export function tabroomCredentials(): TabroomCredentials | null {
  for (const key of TABROOM_TOKEN_ENV) {
    const token = getEnv(key)?.trim();
    if (token) return { token, cookieName: getEnv("TABROOM_COOKIE_NAME")?.trim() || undefined };
  }
  return null;
}

/** `fetch` that sends the site's Tabroom session cookie on every request; plain `fetch` when none is configured. */
export function tabroomFetch(credentials = tabroomCredentials()): typeof fetch {
  if (!credentials) return (...args) => fetch(...args);
  const cookie = tabroomCookie(credentials);
  return (input, init) => {
    const headers = new Headers(init?.headers);
    headers.set("cookie", cookie);
    return fetch(input, { ...init, headers });
  };
}
