/**
 * Remembered body zoom — the last zoom % the user picked in the editor, kept
 * in this browser's localStorage and keyed to the signed-in account.
 *
 * Upstream treats body zoom as transient: every editor opens at the
 * `defaultZoomPct` setting and forgets any +/− the user did. On debate-ai.com
 * people zoom once and expect every file after that to open the same way, so
 * each zoom change is written here and read back whenever an editor (or a new
 * multi-doc pane) opens. `defaultZoomPct` stays the fallback until the user
 * has zoomed at least once in this browser.
 *
 * Deliberately local, not part of the synced `pmd-settings` object: zoom is a
 * per-screen choice (a laptop and a monitor want different zooms), so it is
 * scoped to the browser and, within it, to the account that is signed in.
 *
 * Light module: no imports, every storage access guarded (private windows,
 * disabled storage, SSR).
 */

/** Prefix of the localStorage key; the account scope is appended. */
export const REMEMBERED_ZOOM_KEY_PREFIX = 'debate-editor-zoom';

/** Where `collab/account-sync.ts` caches who is signed in. Read raw so this
 *  module never starts that module's network refresh. */
const ACCOUNT_SYNC_LS_KEY = 'debate-editor-account-sync';

/** Scope used when nobody is signed in. */
const GUEST_SCOPE = 'guest';

function ls(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
}

/** The account scope for the key: the cached signed-in email, or `guest`. */
function accountScope(storage: Storage): string {
  try {
    const parsed = JSON.parse(storage.getItem(ACCOUNT_SYNC_LS_KEY) ?? 'null') as {
      signedIn?: unknown;
      email?: unknown;
    } | null;
    if (parsed && parsed.signedIn === true && typeof parsed.email === 'string' && parsed.email) {
      return parsed.email.trim().toLowerCase();
    }
  } catch {
    /* corrupt cache — fall through to guest */
  }
  return GUEST_SCOPE;
}

/** The full localStorage key for the current account. */
export function rememberedZoomKey(): string {
  const storage = ls();
  return `${REMEMBERED_ZOOM_KEY_PREFIX}:${storage ? accountScope(storage) : GUEST_SCOPE}`;
}

/**
 * The zoom % last picked in this browser by the current account, or `null`
 * when none is stored (or the stored value is unusable). Callers clamp it.
 */
export function loadRememberedZoom(): number | null {
  const storage = ls();
  if (!storage) return null;
  try {
    const raw = storage.getItem(`${REMEMBERED_ZOOM_KEY_PREFIX}:${accountScope(storage)}`);
    if (raw === null) return null;
    const pct = Number(raw);
    return Number.isFinite(pct) && pct > 0 ? pct : null;
  } catch {
    return null;
  }
}

/** Store the zoom % the user just picked, for every editor opened later. */
export function saveRememberedZoom(pct: number): void {
  if (!Number.isFinite(pct) || pct <= 0) return;
  const storage = ls();
  if (!storage) return;
  try {
    storage.setItem(`${REMEMBERED_ZOOM_KEY_PREFIX}:${accountScope(storage)}`, String(Math.round(pct)));
  } catch {
    /* storage full / disabled — zoom still works, it just isn't remembered */
  }
}

/** The zoom a new editor should open at: the remembered one, else `fallback`. */
export function initialZoomPct(fallback: number): number {
  return loadRememberedZoom() ?? fallback;
}
