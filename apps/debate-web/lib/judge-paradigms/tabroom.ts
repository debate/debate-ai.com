/**
 * @fileoverview The Tabroom account this site signs its Tabroom requests in as.
 *
 * Tabroom answers many reads only for signed-in users (paradigms, judging
 * records, round results, and increasingly its API and classic pages in
 * general). Every server-side request to tabroom.com from the Worker goes
 * through {@link tabroomFetch}, which adds the site account's session cookie,
 * `TabroomToken=<value>`.
 *
 * The session comes from the Tabroom login an admin saves under Admin →
 * Service logins (`lib/service-logins`): the site logs in with it, stores the
 * token, and logs in again only when Tabroom rejects that token. Without a
 * saved login (or while it can't sign in) the `TABROOM_API_KEY` secret is the
 * fallback: the `TabroomToken` cookie copied from a browser signed in at
 * tabroom.com, raw (`$6$…`) or URL-encoded (`%246%24…`).
 * `TABROOM_SESSION_TOKEN` is still read as a fallback for existing
 * deployments. Set `TABROOM_COOKIE_NAME` if Tabroom ever renames the cookie.
 * With neither, requests go out signed out.
 *
 * @module lib/judge-paradigms/tabroom
 */

import { tabroomCookie, type TabroomCredentials } from "@debate-ai/tournaments/server";
import { getEnv } from "@/lib/env";
import { TABROOM_TOKEN_ENV, serviceSession, tabroomEnvToken } from "@/lib/service-logins";

export { TABROOM_TOKEN_ENV };

/** The Tabroom session from `TABROOM_API_KEY`; `null` when unset. */
export function tabroomCredentials(): TabroomCredentials | null {
  const token = tabroomEnvToken();
  return token ? { token, cookieName: getEnv("TABROOM_COOKIE_NAME")?.trim() || undefined } : null;
}

/**
 * The site's Tabroom session: the saved login's token (logging in when it has
 * none), else `TABROOM_API_KEY`; `null` when neither is available.
 */
export async function siteTabroomCredentials(): Promise<TabroomCredentials | null> {
  const token = await serviceSession("tabroom").token();
  return token ? { token, cookieName: getEnv("TABROOM_COOKIE_NAME")?.trim() || undefined } : null;
}

/**
 * `fetch` signed in as the site's Tabroom account. With no argument it uses
 * the saved login (re-logging in once when Tabroom rejects its token) and
 * falls back to `TABROOM_API_KEY`; given `credentials`, it sends exactly
 * those, and plain `fetch` for `null`.
 */
export function tabroomFetch(credentials?: TabroomCredentials | null): typeof fetch {
  if (credentials === undefined) return serviceSession("tabroom").fetch as typeof fetch;
  if (!credentials) return (...args) => fetch(...args);
  const cookie = tabroomCookie(credentials);
  return (input, init) => {
    const headers = new Headers(init?.headers);
    headers.set("cookie", cookie);
    return fetch(input, { ...init, headers });
  };
}
