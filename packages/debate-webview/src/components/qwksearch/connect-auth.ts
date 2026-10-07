/**
 * @fileoverview "Sign in with QwkSearch" auth client for the embedded
 * qwksearch research workspace.
 *
 * qwksearch.com's own auth routes are same-site only, so the embed used to run
 * permanently as a guest and its login button could only say "Sign-in for
 * research chats is available on qwksearch.com". Signing in now goes through
 * QwkSearch's OAuth-style consent screen instead: `/api/qwksearch/connect`
 * starts the flow, QwkSearch asks the user to allow Debate AI, and
 * `/api/qwksearch/callback` stores the user's QwkSearch API key on their
 * debate-ai account (the `qwksearch_connection` table; see
 * apps/debate-ai.com/lib/qwksearch/connect.ts).
 *
 * This client reads that link back from `/api/qwksearch/session` and attaches
 * the key as `X-API-Key` to every request the embed makes to qwksearch.com's
 * API — so chats, history and the user's QwkSearch plan work as they do on
 * qwksearch.com. Upgrading happens on QwkSearch, through the plan's Stripe
 * link the session carries (`upgradeUrl`).
 *
 * Mirrors `createQwkSearchConnectAuthClient` from research-agent-ui (added in
 * the release after 0.1.293); swap this for that export once the dependency
 * is bumped.
 *
 * The object satisfies both consumers of an auth client in the ported code:
 * `SessionProvider` (ResearchAgentAuthClient) and the ported settings
 * Account section (`useSession`, `signIn.social`, `signOut`).
 */
import { useEffect, useSyncExternalStore } from "react"
import { toast } from "sonner"
import type { ResearchAgentAuthClient } from "research-agent-ui"
import { QWKSEARCH_ORIGIN } from "./base-url"

export const QWKSEARCH_SESSION_URL = "/api/qwksearch/session"
export const QWKSEARCH_CONNECT_URL = "/api/qwksearch/connect"
export const QWKSEARCH_DISCONNECT_URL = "/api/qwksearch/disconnect"

/** What `/api/qwksearch/session` answers. */
export interface QwkSearchSession {
  connected: boolean
  user?: { id: string; name: string; email?: string; image?: string | null } | null
  apiKey?: string | null
  plan?: string | null
  upgradeUrl?: string | null
}

// ---------------------------------------------------------------------------
// API key header scoping
// ---------------------------------------------------------------------------

let activeKey: string | null = null
let fetchHooked = false

/** True when `input` targets qwksearch.com's `/api/`. */
export function isQwkSearchApiRequest(input: RequestInfo | URL, origin: string = QWKSEARCH_ORIGIN): boolean {
  const raw = typeof input === "string" ? input : input instanceof URL ? input.href : input.url
  try {
    const url = new URL(raw, typeof window !== "undefined" ? window.location.href : origin)
    return url.origin === origin && url.pathname.startsWith("/api/")
  } catch {
    return false
  }
}

/**
 * Wraps `fetch` once so requests to qwksearch.com's API carry the linked key.
 * Covers the bundled qwksearch-api-client, grab-url and plain fetch alike;
 * requests to any other URL — debate-ai's own `/api` included — and every
 * request while no account is linked pass through untouched.
 */
function hookFetch(): void {
  if (fetchHooked || typeof window === "undefined" || typeof window.fetch !== "function") return
  fetchHooked = true
  const original = window.fetch.bind(window)
  window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    if (!activeKey || !isQwkSearchApiRequest(input)) return original(input, init)
    const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined))
    if (!headers.has("x-api-key") && !headers.has("authorization")) headers.set("X-API-Key", activeKey)
    return original(input, { ...init, headers })
  }
}

export function setQwkSearchApiKey(key: string | null): void {
  activeKey = key || null
  if (activeKey) hookFetch()
}

// ---------------------------------------------------------------------------
// Session store
// ---------------------------------------------------------------------------

let current: QwkSearchSession = { connected: false }
let loaded = false
let inFlight: Promise<QwkSearchSession> | null = null
const listeners = new Set<() => void>()

function publish(session: QwkSearchSession): void {
  current = session
  loaded = true
  setQwkSearchApiKey(session.connected ? session.apiKey ?? null : null)
  listeners.forEach((listener) => listener())
}

/** Reads the link from the server; `refresh` re-checks the plan with QwkSearch. */
export function loadQwkSearchSession(refresh = false): Promise<QwkSearchSession> {
  if (inFlight && !refresh) return inFlight
  const request = fetch(`${QWKSEARCH_SESSION_URL}${refresh ? "?refresh=1" : ""}`, {
    credentials: "same-origin",
    headers: { Accept: "application/json" },
  })
    .then(async (res) => (res.ok ? ((await res.json()) as QwkSearchSession) : { connected: false }))
    .catch(() => ({ connected: false }) as QwkSearchSession)
    .then((session) => {
      publish(session)
      return session
    })
    .finally(() => {
      if (inFlight === request) inFlight = null
    })
  inFlight = request
  return request
}

const subscribe = (listener: () => void) => {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** The current link, re-rendering when it changes. Loads it on first use. */
export function useQwkSearchSession(): { session: QwkSearchSession; isPending: boolean } {
  const session = useSyncExternalStore(subscribe, () => current, () => current)
  const isLoaded = useSyncExternalStore(subscribe, () => loaded, () => false)
  useEffect(() => {
    if (!loaded) void loadQwkSearchSession()
  }, [])
  return { session, isPending: !isLoaded }
}

/** Sends the visitor through "Sign in with QwkSearch", back to `returnTo` (default: here). */
export function connectQwkSearch(returnTo?: string): void {
  if (typeof window === "undefined") return
  const back = returnTo ?? `${window.location.pathname}${window.location.search}`
  window.location.assign(`${QWKSEARCH_CONNECT_URL}?returnTo=${encodeURIComponent(back)}`)
}

/** Unlinks the QwkSearch account; the embed goes back to running as a guest. */
export async function disconnectQwkSearch(): Promise<void> {
  try {
    await fetch(QWKSEARCH_DISCONNECT_URL, { method: "POST", credentials: "same-origin" })
  } finally {
    publish({ connected: false })
  }
}

const OUTCOME_MESSAGES: Record<string, [kind: "success" | "info" | "error", message: string]> = {
  connected: ["success", "Signed in with QwkSearch — research chats now use your QwkSearch account."],
  denied: ["info", "QwkSearch sign-in was cancelled."],
  error: ["error", "QwkSearch sign-in failed. Please try again."],
}

/**
 * Announces how "Sign in with QwkSearch" ended — `/api/qwksearch/callback`
 * returns to the starting page with `?qwksearch=<outcome>` — then drops the
 * parameter from the address bar so a reload doesn't repeat it.
 */
export function useQwkSearchConnectOutcome(): void {
  useEffect(() => {
    const url = new URL(window.location.href)
    const outcome = url.searchParams.get("qwksearch")
    if (!outcome) return
    const entry = OUTCOME_MESSAGES[outcome]
    if (entry) toast[entry[0]](entry[1])
    url.searchParams.delete("qwksearch")
    window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`)
  }, [])
}

/**
 * Structurally satisfies `ResearchAgentAuthClient` (its members accept a
 * superset of the calls the ported code makes — some call sites pass no
 * arguments, so every parameter here is optional).
 */
export const authClient = {
  getSession: async () => {
    const session = await loadQwkSearchSession()
    return { data: session.connected && session.user ? { user: session.user } : null }
  },
  useSession: () => {
    const { session, isPending } = useQwkSearchSession()
    return { data: session.connected && session.user ? { user: session.user } : null, isPending }
  },
  // One Tap would sign in to *this* origin's Google client; the connect flow
  // replaces it.
  oneTap: (_opts?: { fetchOptions: { onSuccess: () => void } }) => {},
  signIn: {
    social: (_opts?: { provider: string; callbackURL: string }) => {
      connectQwkSearch()
    },
  },
  signOut: async (opts?: { fetchOptions?: { onSuccess?: () => void } }) => {
    await disconnectQwkSearch()
    opts?.fetchOptions?.onSuccess?.()
    return { data: null }
  },
} satisfies ResearchAgentAuthClient & Record<string, unknown>
