/**
 * @fileoverview "Sign in with QwkSearch" — linking a debate-ai account to a
 * QwkSearch account so the embedded research workspace (`/doc`, /research,
 * settings → Research) runs as that QwkSearch user instead of a guest.
 *
 * QwkSearch runs the consent screen (`qwksearch.com/connect`) and hands back
 * an authorization code; this app redeems it server-to-server with a PKCE
 * verifier and stores the user's QwkSearch API key, profile and plan in
 * the `qwksearch_connection` table. The embed reads it back from
 * `/api/qwksearch/session` and sends the key as `X-API-Key` on every
 * qwksearch.com API call. Upgrading happens on QwkSearch (its Stripe Payment
 * Link, tied to the QwkSearch account), and `/api/qwksearch/session?refresh=1`
 * re-reads the plan afterwards.
 *
 * The QwkSearch side is apps/qwksearch-web/lib/auth/connect.ts in
 * OpenSourceAGI/qwksearch-research-agent. Everything in this file is pure so
 * it can be tested without D1.
 */

/** Default QwkSearch deployment; override with the `QWKSEARCH_ORIGIN` env var. */
export const DEFAULT_QWKSEARCH_ORIGIN = "https://qwksearch.com"

/** Cookie holding the in-flight flow's PKCE verifier, state and return path. */
export const CONNECT_COOKIE = "qwk_connect"
/** Matches QwkSearch's own sign-in window; the code itself lives two minutes. */
export const CONNECT_COOKIE_MAX_AGE_SECONDS = 600
/** Path every route of the flow lives under, so the cookie goes nowhere else. */
export const CONNECT_COOKIE_PATH = "/api/qwksearch"
/** Where QwkSearch sends the visitor back, relative to this app's origin. */
export const CALLBACK_PATH = "/api/qwksearch/callback"

/** The linked account, as stored in the `qwksearch_connection` table. */
export interface QwkSearchConnection {
  apiKey: string
  user: { id: string; name: string; email?: string; image?: string | null }
  plan: string
  upgradeUrl: string | null
  /** ISO timestamp of the link (or the last plan refresh). */
  connectedAt: string
}

/** What `/api/qwksearch/session` answers — the shape research-agent-ui expects. */
export interface QwkSearchSessionPayload {
  connected: boolean
  user?: QwkSearchConnection["user"] | null
  apiKey?: string | null
  plan?: string | null
  upgradeUrl?: string | null
}

export function qwksearchOrigin(configured?: string | null): string {
  const value = configured?.trim()
  if (!value) return DEFAULT_QWKSEARCH_ORIGIN
  try {
    return new URL(value).origin
  } catch {
    return DEFAULT_QWKSEARCH_ORIGIN
  }
}

/**
 * The in-app path to return to after the flow. Same-origin paths only, so
 * `returnTo` can't be turned into an open redirect.
 */
export function safeReturnTo(raw: string | null | undefined): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//") || raw.startsWith("/\\")) return "/doc"
  return raw
}

/** Adds `qwksearch=<status>` to a return path so the page can toast the outcome. */
export function withStatus(returnTo: string, status: string): string {
  const url = new URL(returnTo, "https://placeholder.invalid")
  url.searchParams.set("qwksearch", status)
  return `${url.pathname}${url.search}${url.hash}`
}

function base64Url(bytes: Uint8Array): string {
  let binary = ""
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
}

/** A random URL-safe token of `bytes` bytes of entropy (43 chars for 32). */
export function randomToken(bytes = 32): string {
  return base64Url(crypto.getRandomValues(new Uint8Array(bytes)))
}

/** PKCE S256: base64url(SHA-256(verifier)). */
export async function pkceChallenge(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier))
  return base64Url(new Uint8Array(digest))
}

export function buildAuthorizeUrl(params: {
  origin: string
  redirectUri: string
  state: string
  challenge: string
}): string {
  const url = new URL("/connect", params.origin)
  url.searchParams.set("redirect_uri", params.redirectUri)
  url.searchParams.set("state", params.state)
  url.searchParams.set("code_challenge", params.challenge)
  url.searchParams.set("code_challenge_method", "S256")
  return url.toString()
}

/** The cookie's contents while a flow is in flight. */
export interface PendingConnect {
  verifier: string
  state: string
  returnTo: string
}

export function serializePending(pending: PendingConnect): string {
  return encodeURIComponent(JSON.stringify(pending))
}

export function parsePending(raw: string | null | undefined): PendingConnect | null {
  if (!raw) return null
  try {
    const value = JSON.parse(decodeURIComponent(raw))
    if (typeof value?.verifier !== "string" || typeof value.state !== "string") return null
    return { verifier: value.verifier, state: value.state, returnTo: safeReturnTo(value.returnTo) }
  } catch {
    return null
  }
}

/** Constant-time string comparison for the `state` check. */
export function sameString(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

/**
 * Builds a connection from QwkSearch's `/api/connect/token` answer (or, with
 * `previous`, refreshes one from `/api/connect/me`, which omits the key).
 * Returns null for a response missing what the embed needs.
 */
export function connectionFromToken(
  body: unknown,
  previous?: QwkSearchConnection | null,
  now: Date = new Date(),
): QwkSearchConnection | null {
  const data = body as {
    api_key?: unknown
    user?: { id?: unknown; name?: unknown; email?: unknown; image?: unknown }
    plan?: unknown
    upgrade_url?: unknown
  } | null
  const apiKey = typeof data?.api_key === "string" ? data.api_key : previous?.apiKey
  const user = data?.user
  if (!apiKey || typeof user?.id !== "string") return null
  return {
    apiKey,
    user: {
      id: user.id,
      name: typeof user.name === "string" ? user.name : "",
      ...(typeof user.email === "string" ? { email: user.email } : {}),
      image: typeof user.image === "string" ? user.image : null,
    },
    plan: typeof data?.plan === "string" ? data.plan : "free",
    upgradeUrl: typeof data?.upgrade_url === "string" ? data.upgrade_url : null,
    connectedAt: now.toISOString(),
  }
}

export function serializeConnection(connection: QwkSearchConnection | null): string | null {
  return connection ? JSON.stringify(connection) : null
}

export function parseConnection(raw: string | null | undefined): QwkSearchConnection | null {
  if (!raw) return null
  try {
    const stored = JSON.parse(raw) as Partial<QwkSearchConnection>
    const connection = connectionFromToken({
      api_key: stored?.apiKey,
      user: stored?.user,
      plan: stored?.plan,
      upgrade_url: stored?.upgradeUrl,
    })
    return connection && { ...connection, connectedAt: stored.connectedAt ?? connection.connectedAt }
  } catch {
    return null
  }
}

export function toSessionPayload(connection: QwkSearchConnection | null): QwkSearchSessionPayload {
  if (!connection) return { connected: false }
  return {
    connected: true,
    user: connection.user,
    apiKey: connection.apiKey,
    plan: connection.plan,
    upgradeUrl: connection.upgradeUrl,
  }
}
