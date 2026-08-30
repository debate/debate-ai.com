/**
 * Collaboration-session feature gate.
 *
 * Open everywhere collaboration can exist: every desktop host, and —
 * since the 2026-08-19 soft launch — browser hosts too. Closed only
 * where it can't: Lite builds and the mobile shell. This gate decides
 * whether collab SURFACES exist at all; whether they're active is the
 * user's 'Enable collaboration' master toggle (default off), so the
 * ungating itself changed nothing for anyone who hasn't opted in.
 * (The old `pmd-collab-web` prototype flag is retired.)
 *
 * `pmd-collab-web-relay-url` / `pmd-collab-web-relay-token` remain as
 * a runtime relay override for dev/self-hosting on hosts without the
 * Electron-only relay settings fields (see collabDevRelay below).
 *
 * Zero heavy imports — this module is consulted from the main editor
 * path; `host` is already on that path (types-only wrappers), and
 * everything Loro/collab loads lazily only after the gate opens.
 */

import { getHost } from '../host/index.js';
import { isLiteBuild } from '../lite.js';
import { settings } from '../settings.js';
import { resolveMobileLayout, detectEmbedded } from '../mobile-layout.js';

/** Mirrors `index.ts`'s boot-time mobile-shell resolution, memoized
 *  once per page load (same reload-to-switch convention — resizing
 *  mid-session must not flip the gate under an open session). */
let mobileShellMemo: boolean | null = null;
function isMobileShell(): boolean {
  if (mobileShellMemo !== null) return mobileShellMemo;
  try {
    mobileShellMemo = resolveMobileLayout(settings.get('mobileLayout'), {
      hostKind: getHost().kind,
      coarsePointer:
        typeof window.matchMedia === 'function' &&
        window.matchMedia('(pointer: coarse)').matches,
      viewportWidth: window.innerWidth,
      embedded: detectEmbedded(),
    });
  } catch {
    /* unresolvable layout → treat as mobile, gate stays closed */
    mobileShellMemo = true;
  }
  return mobileShellMemo;
}

export function collabEnabled(): boolean {
  // Lite builds have no collaboration at all — closing this gate is
  // what removes the pills, sessions list, join links, web account
  // wiring, and every collab command in one move.
  if (isLiteBuild()) return false;
  try {
    // On desktop (Electron / a future non-browser host) co-editing is on.
    if (getHost().kind !== 'browser') return true;
    // Web ships ungated as of 2026-08-19 (soft launch) — everything
    // stays opt-in behind the 'Enable collaboration' master toggle,
    // this gate only decides whether the surfaces exist. The mobile
    // shell is the one exclusion: co-editing is a desktop-layout
    // feature (user decision 2026-08-18).
    return !isMobileShell();
  } catch {
    /* no host resolvable → treat as not-desktop, stay closed */
    return false;
  }
}

/** Dev/prototype relay config for hosts without the Electron-only
 *  Collaboration settings fields. Two sources, runtime first:
 *  the web-prototype localStorage pair (set from the console, works in
 *  packaged web builds), then the vite build-time env vars. Falls
 *  through (null) when neither is set. */
export function collabDevRelay(): { url: string; token: string } | null {
  try {
    const url = (window.localStorage.getItem('pmd-collab-web-relay-url') ?? '').trim();
    const token = (window.localStorage.getItem('pmd-collab-web-relay-token') ?? '').trim();
    if (url && token) return { url, token };
  } catch {
    /* no localStorage (non-DOM host) */
  }
  try {
    const env = (import.meta as { env?: Record<string, string> }).env;
    const url = (env?.['VITE_COLLAB_RELAY'] ?? '').trim();
    const token = (env?.['VITE_COLLAB_TOKEN'] ?? '').trim();
    if (url && token) return { url, token };
  } catch {
    /* no import.meta.env outside vite */
  }
  return null;
}
