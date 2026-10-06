/**
 * "Bring your own key" for the AI routes.
 *
 * `/api/reason-ai` and `/api/card-ai-analysis` normally call the model with
 * the site's one shared OpenRouter (or Anthropic) key, metered by the daily
 * plan limits in `../stripe/limits.ts`. When that shared key runs out of
 * credit, or a user wants more than their plan allows, they can paste their
 * own OpenRouter or Anthropic key instead: requests then go out on that key,
 * under whatever spending limit the user set on it with their provider, and
 * Debate AI's daily limits don't apply.
 *
 * The key is a secret this browser holds. It lives in `localStorage` only —
 * never in the account's settings row (see `editor-preferences.ts`, which
 * keeps credentials out for the same reason) — and `attachOwnAiKey` adds it as
 * the `x-user-ai-key` header on same-origin requests to the AI routes alone.
 * The server reads it per request and never stores or logs it.
 *
 * No React here, so the server routes import the same parsing and both halves
 * test without a DOM.
 */

/** Request header carrying the user's own key to the AI routes. */
export const OWN_AI_KEY_HEADER = "x-user-ai-key";

/**
 * Response header an AI route sets when the site's shared key can't serve the
 * request (out of credit, or its provider-side spending limit is reached).
 * The client watches for it to offer the own-key dialog.
 */
export const AI_KEY_NEEDED_HEADER = "x-ai-key-needed";

/** The same-origin routes the own key is sent to. Nothing else ever sees it. */
export const OWN_AI_KEY_ROUTES: readonly string[] = ["/api/reason-ai", "/api/card-ai-analysis"];

/** Where a user creates a key and sets its spending limit. */
export const OPENROUTER_KEYS_URL = "https://openrouter.ai/settings/keys";

export type AiKeyProvider = "openrouter" | "anthropic";

export interface OwnAiKey {
  provider: AiKeyProvider;
  key: string;
}

const STORAGE_KEY = "debate-ai.ownAiKey";
const MAX_KEY_LENGTH = 256;

/**
 * The provider a pasted key belongs to, from its prefix, or `null` when it is
 * neither an OpenRouter (`sk-or-…`) nor an Anthropic (`sk-ant-…`) key.
 */
export function parseOwnAiKey(raw: string | null | undefined): OwnAiKey | null {
  const key = (raw ?? "").trim();
  if (!key || key.length > MAX_KEY_LENGTH || /\s/.test(key)) return null;
  if (key.startsWith("sk-or-")) return { provider: "openrouter", key };
  if (key.startsWith("sk-ant-")) return { provider: "anthropic", key };
  return null;
}

/** `sk-or-v1-…abcd`: enough to recognise a saved key without showing it. */
export function maskOwnAiKey(key: string): string {
  if (key.length <= 12) return "••••";
  return `${key.slice(0, 8)}…${key.slice(-4)}`;
}

type Listener = (key: OwnAiKey | null) => void;
const listeners = new Set<Listener>();

function storage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

/** The key saved in this browser, or `null`. */
export function getOwnAiKey(): OwnAiKey | null {
  try {
    return parseOwnAiKey(storage()?.getItem(STORAGE_KEY));
  } catch {
    return null;
  }
}

/** Saves `raw` when it parses as a key; returns what was saved, or `null` (nothing changed). */
export function setOwnAiKey(raw: string): OwnAiKey | null {
  const parsed = parseOwnAiKey(raw);
  if (!parsed) return null;
  try {
    storage()?.setItem(STORAGE_KEY, parsed.key);
  } catch {
    // Storage blocked (private window): the key still applies to this page.
  }
  memoryKey = parsed;
  for (const listener of listeners) listener(parsed);
  return parsed;
}

export function clearOwnAiKey(): void {
  try {
    storage()?.removeItem(STORAGE_KEY);
  } catch {
    // Nothing stored to remove.
  }
  memoryKey = null;
  for (const listener of listeners) listener(null);
}

/** Fallback for a browser whose storage throws, so a saved key still applies until reload. */
let memoryKey: OwnAiKey | null = null;

function currentKey(): OwnAiKey | null {
  return getOwnAiKey() ?? memoryKey;
}

export function subscribeOwnAiKey(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Whether `input` is a same-origin request to one of the AI routes. */
export function isOwnAiKeyRoute(input: RequestInfo | URL, origin?: string): boolean {
  const raw = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  let url: URL;
  try {
    url = new URL(raw, origin ?? "http://localhost");
  } catch {
    return false;
  }
  if (origin && url.origin !== new URL(origin).origin) return false;
  if (!origin && /^[a-z][a-z0-9+.-]*:/i.test(raw)) return false;
  return OWN_AI_KEY_ROUTES.includes(url.pathname);
}

type AiKeyNeededListener = () => void;
const neededListeners = new Set<AiKeyNeededListener>();

export function subscribeToAiKeyNeeded(listener: AiKeyNeededListener): () => void {
  neededListeners.add(listener);
  return () => {
    neededListeners.delete(listener);
  };
}

const ATTACHED = Symbol.for("debate-ai.ownAiKeyFetch");

/**
 * Wraps `target.fetch` (the window by default) so requests to the AI routes
 * carry the saved key, and a response saying the shared key is exhausted
 * notifies `subscribeToAiKeyNeeded` listeners. Idempotent per target; returns
 * a function that restores it.
 */
export function attachOwnAiKey(target: { fetch: typeof fetch; location?: { origin: string } } = globalThis): () => void {
  const current = target.fetch as typeof fetch & { [ATTACHED]?: boolean };
  if (typeof current !== "function" || current[ATTACHED]) return () => {};
  const original = current;
  const wrapped = (async (input: RequestInfo | URL, init?: RequestInit) => {
    if (!isOwnAiKeyRoute(input, target.location?.origin)) return original.call(target, input, init);
    const own = currentKey();
    let nextInit = init;
    if (own) {
      const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined));
      headers.set(OWN_AI_KEY_HEADER, own.key);
      nextInit = { ...init, headers };
    }
    const response = await original.call(target, input, nextInit);
    if (response.headers.get(AI_KEY_NEEDED_HEADER)) {
      for (const listener of neededListeners) listener();
    }
    return response;
  }) as typeof fetch & { [ATTACHED]?: boolean };
  wrapped[ATTACHED] = true;
  target.fetch = wrapped;
  return () => {
    if (target.fetch === wrapped) target.fetch = original;
  };
}

/**
 * Whether a provider's error reply means the key itself is out of money or
 * past its spending limit — OpenRouter answers `402` for no credits and `403`
 * "Key limit exceeded" for a key's own cap; Anthropic says "credit balance is
 * too low". A plain rate limit (`429`) is transient and not this.
 */
export function isKeyExhaustedError(status: number, detail: string): boolean {
  if (status === 402) return true;
  if (status !== 400 && status !== 403) return false;
  return /limit exceeded|credit|insufficient|billing/i.test(detail);
}
