/**
 * @fileoverview The Tabroom account this site reads judges' paradigms as.
 *
 * Tabroom only shows paradigms and judging records to signed-in users, on
 * its API and its classic site alike. `TABROOM_SESSION_TOKEN` holds the
 * session token of a Tabroom account the site signs in as — the value of the
 * `TabroomToken` cookie after signing in at tabroom.com (set
 * `TABROOM_COOKIE_NAME` if Tabroom ever renames that cookie). Unset, every
 * live read answers "unauthorized" and only already-synced judges show.
 *
 * @module lib/judge-paradigms/tabroom
 */

import { DEFAULT_TABROOM_COOKIE, type TabroomCredentials } from "@debate-ai/tournaments/server";
import { getEnv } from "@/lib/env";

/** The Tabroom session the site reads paradigms as, from `TABROOM_SESSION_TOKEN`; `null` when unset. */
export function tabroomCredentials(): TabroomCredentials | null {
  const token = getEnv("TABROOM_SESSION_TOKEN")?.trim();
  if (!token) return null;
  return { token, cookieName: getEnv("TABROOM_COOKIE_NAME")?.trim() || undefined };
}

/** `fetch` that sends the site's Tabroom session to tabroom.com, for the classic paradigm search. */
export function tabroomFetch(credentials = tabroomCredentials()): typeof fetch {
  if (!credentials) return (...args) => fetch(...args);
  const cookie = `${credentials.cookieName || DEFAULT_TABROOM_COOKIE}=${credentials.token}`;
  return (input, init) => {
    const headers = new Headers(init?.headers);
    headers.set("cookie", cookie);
    return fetch(input, { ...init, headers });
  };
}

