/**
 * @fileoverview The hosts this deployment answers on, and the origin allowlist
 * better-auth checks every state-changing auth request against.
 *
 * Kept out of `./index` so it can be unit tested on its own: building the auth
 * instance needs a D1 binding, and this is the part that decides whether a
 * sign-in is accepted at all.
 */

import { APP_ORIGIN } from "../config/site";

/**
 * Every host that serves this app.
 *
 * `debate-ai.com` is canonical, `ebate.app` is the short domain pointed at the
 * same Worker, the wildcards cover preview deployments, and localhost is dev.
 * better-auth derives one base URL per request from this list, so a visitor on
 * ebate.app keeps ebate.app for their cookies, OAuth callback and magic link
 * instead of being handed the canonical domain halfway through signing in.
 *
 * This is an allowlist rather than "whatever the Host header says" on purpose:
 * an unchecked host would let a spoofed request mint magic links pointing at
 * someone else's domain.
 */
export const DEFAULT_ALLOWED_HOSTS = [
  "debate-ai.com",
  "www.debate-ai.com",
  "*.debate-ai.com",
  "ebate.app",
  "www.ebate.app",
  "*.workers.dev",
  "*.vercel.app",
  "localhost:3000",
  "127.0.0.1:3000",
];

/**
 * Origin patterns accepted in addition to the ones implied by the hosts above.
 * Kept for anything that is an origin rather than a host — including whatever
 * `BETTER_AUTH_TRUSTED_ORIGINS` supplies.
 */
export const DEFAULT_TRUSTED_ORIGINS = [APP_ORIGIN, "http://localhost:3000"];

/** Split a comma-separated env value into trimmed, non-empty entries. */
export function parseList(raw: string | undefined | null): string[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

/**
 * The host (including port) of a URL or bare host string, or `null` when the
 * value is not something a browser could be served from.
 */
export function hostOf(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  try {
    return new URL(trimmed.includes("://") ? trimmed : `https://${trimmed}`).host || null;
  } catch {
    return null;
  }
}

/**
 * The hosts better-auth may resolve a base URL for: the built-in list, plus
 * anything an operator adds via `BETTER_AUTH_ALLOWED_HOSTS`, plus the host of
 * any explicitly configured base URL so pinning one does not lock the others
 * out.
 *
 * Entries may be given as hosts (`ebate.app`), origins
 * (`https://ebate.app`) or wildcard patterns (`*.vercel.app`); origins are
 * reduced to their host, which is what better-auth matches on.
 */
export function buildAllowedHosts({
  configuredBaseURL,
  extraHosts,
}: {
  configuredBaseURL?: string;
  extraHosts?: string;
} = {}): string[] {
  const entries = [
    ...DEFAULT_ALLOWED_HOSTS,
    ...parseList(extraHosts),
    ...(configuredBaseURL ? [configuredBaseURL] : []),
  ];

  const hosts = entries.map((entry) =>
    // Wildcard patterns are matched against the host as written; running them
    // through the URL parser would mangle `*.vercel.app`.
    entry.includes("*") ? entry.replace(/^https?:\/\//, "").split("/")[0] : hostOf(entry),
  );

  return Array.from(new Set(hosts.filter((host): host is string => Boolean(host))));
}

/**
 * Origins accepted by the CSRF origin check on top of the ones better-auth
 * already derives from {@link buildAllowedHosts}.
 */
export function buildTrustedOrigins({
  configuredBaseURL,
  extraOrigins,
}: {
  configuredBaseURL?: string;
  extraOrigins?: string;
} = {}): string[] {
  return Array.from(
    new Set(
      [
        ...DEFAULT_TRUSTED_ORIGINS,
        ...(configuredBaseURL ? [configuredBaseURL] : []),
        ...parseList(extraOrigins),
      ]
        .map((origin) => origin.trim())
        .filter(Boolean),
    ),
  );
}
