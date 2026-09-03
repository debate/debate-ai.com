/**
 * Host-bound Learn store singleton.
 *
 * Wraps `LearnStore` with debounced persistence to the host KV
 * (`writeLearnStore`) and a one-time load from it (`readLearnStore`).
 * Other modules import `learnStore` directly; `loadLearnStore()` is
 * awaited once at boot.
 */

import { LearnStore } from './learn-store.js';
import { getHost } from './host/index.js';
import type { AnchorDescriptor } from './learn-anchor.js';

const PERSIST_DELAY_MS = 400;
let writeTimer: number | null = null;
let pending: string | null = null;

function debouncedPersist(json: string): void {
  pending = json;
  if (writeTimer !== null) return;
  writeTimer = window.setTimeout(() => {
    writeTimer = null;
    const j = pending;
    pending = null;
    if (j !== null) void getHost().writeLearnStore(j);
  }, PERSIST_DELAY_MS);
}

export const learnStore = new LearnStore(debouncedPersist);

let loaded = false;
/** Load the persisted store once. Safe to call repeatedly. */
export async function loadLearnStore(): Promise<void> {
  if (loaded) return;
  loaded = true;
  try {
    learnStore.loadJson(await getHost().readLearnStore());
  } catch (err) {
    console.warn('Failed to load learn store:', err);
  }
}

/** Today as a local-day `YYYY-MM-DD` string (the scheduler's day bucket). */
export function localToday(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// ── "Show in context" host hook ──────────────────────────────────────
// The review session (`learn-session-ui.ts`) is store-only and must not
// import the editor entry (`index.ts`) — that would pull index.ts's
// boot-time side effects into the wrong load order. So index.ts (which
// owns file-open + the active view) registers a handler here, and the
// session UI calls `showFlashcardInContext` to open a card's source file
// and focus its anchored text. Mirrors the learn store's host seam.

export interface ShowInContextRequest {
  /** Absolute path to the source file. */
  path: string;
  /** Display name (for toasts / the open flow). */
  name: string;
  /** The card's stored anchor — resolved against the opened doc. */
  descriptor: AnchorDescriptor;
}

/** `closeSession` lets the handler dismiss the review overlay — it does
 *  so only when the source opens in THIS window (replacing the doc the
 *  overlay covers); opening a separate window leaves the review up. */
export type ShowInContextHandler = (
  req: ShowInContextRequest,
  closeSession: () => void,
) => void;

let showInContextHandler: ShowInContextHandler | null = null;

/** Wire the app-level handler. index.ts calls this at boot; pass null to
 *  clear. */
export function setShowInContextHandler(handler: ShowInContextHandler | null): void {
  showInContextHandler = handler;
}

/** Whether a "show in context" handler is registered (it isn't on hosts
 *  without file-open, e.g. the web build). */
export function canShowInContext(): boolean {
  return showInContextHandler !== null;
}

/** Open a card's source and focus its anchored text. `closeSession` is
 *  invoked by the handler only when it opens in the current window. */
export function showFlashcardInContext(
  req: ShowInContextRequest,
  closeSession: () => void,
): void {
  showInContextHandler?.(req, closeSession);
}
