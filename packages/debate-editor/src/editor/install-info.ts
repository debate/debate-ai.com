/**
 * Read-only diagnostic info about the running install, shown at
 * the bottom of Settings → General. Each entry is a label / value
 * pair the user can copy-paste into a bug report.
 *
 * No host-specific plumbing — everything's derived from things the
 * renderer can see on its own: `package.json` (Vite supports JSON
 * imports natively), the `getHost()` singleton, and `navigator`.
 * Keeps this file build-time-stable without preload-bridge round-
 * trips for what's purely cosmetic metadata.
 */

import pkg from '../../package.json';
import { getHost } from './host/index.js';
import { isLiteBuild } from './lite.js';

/** The running app's version string (from `package.json`). Exported so
 *  the command palette can surface it without re-importing the manifest. */
export const appVersion: string = pkg.version;

/**
 * Compatibility floor for shared cards (cross-machine card sharing).
 *
 * Stamped onto every card this build SENDS as `minReceiverVersion`. A receiver
 * accepts a card unless this floor is set AND the receiver's own version is
 * below it — so **blank (the default) means any version can receive**, and
 * cross-version sharing works.
 *
 * Only raise this when a future release changes the shared-card payload in a way
 * OLDER versions genuinely can't read. Set it to that release's own version
 * (e.g. `'0.1.0-alpha.40'`): from then on, clients older than it refuse the card
 * and prompt the user to update, while equal-or-newer clients accept it. This is
 * how a breaking version can lock out already-shipped older clients without
 * pushing them an update — but note it only governs clients that already carry
 * this floor logic (≥ this release); versions shipped before it still use their
 * old guard.
 */
export const CARD_COMPAT_MIN_VERSION = '';

export interface InstallInfoEntry {
  label: string;
  /** Human-friendly main value, e.g. "0.1.0-alpha.1". */
  value: string;
  /** Whether to display the value monospaced (URLs, UA strings,
   *  long technical IDs). Default false. */
  mono?: boolean;
}

export function getInstallInfo(): InstallInfoEntry[] {
  const hostKind = getHost().kind;
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  const entries: InstallInfoEntry[] = [
    // Edition rides on the Version row: "which build is this?" is the
    // first triage question on any bug report from a Lite install.
    { label: 'Version', value: isLiteBuild() ? `${appVersion} (CardMirror Lite)` : appVersion },
    {
      label: 'Host',
      value: hostKind === 'electron' ? 'Desktop (Electron)' : 'Web browser',
    },
    { label: 'Operating system', value: detectOS(ua) },
  ];
  // Pull Electron / Chromium versions out of the UA into their own
  // labelled rows: named fields make "is the user running the version
  // they think they are?" a one-line check during bug triage instead
  // of a UA-parsing exercise. The web edition has no Electron row;
  // Chromium still applies.
  const chromiumVersion = matchVersion(ua, /Chrome\/(\S+?)\b/);
  const electronVersion = matchVersion(ua, /Electron\/(\S+?)\b/);
  if (chromiumVersion) {
    entries.push({ label: 'Chromium', value: chromiumVersion });
  }
  if (electronVersion) {
    entries.push({ label: 'Electron', value: electronVersion });
  }
  entries.push({ label: 'User agent', value: ua, mono: true });
  return entries;
}

function matchVersion(ua: string, re: RegExp): string | null {
  const m = ua.match(re);
  return m ? m[1] ?? null : null;
}

/** Best-effort OS detection from a user-agent string. The UA is the
 *  only cross-platform-uniform source we can read from the renderer
 *  without going through Electron's preload — `navigator.platform`
 *  is deprecated and increasingly returns generic values.
 *
 *  Exported for tests. */
export function detectOS(ua: string): string {
  if (!ua) return 'Unknown';
  // iOS before macOS: iPhone agents read "… like Mac OS X", so the
  // macOS branch claims them if it runs first. An iPad running modern
  // iPadOS is a genuine blind spot either way — desktop-class Safari
  // identifies as "Macintosh; Intel Mac OS X" with nothing in the agent
  // to tell it apart, so only older iPads land here.
  if (ua.includes('iPhone') || ua.includes('iPad') || ua.includes('iPod')) return 'iOS';
  if (ua.includes('Mac OS X') || ua.includes('Macintosh')) return 'macOS';
  if (ua.includes('Windows')) return 'Windows';
  // Order matters: "Linux" appears in Android UAs too, so check
  // Android first.
  if (ua.includes('Android')) return 'Android';
  // ChromeOS before Linux: Chromebook UAs read `X11; CrOS x86_64 …`,
  // which carries neither "Linux" nor "Android" — so without this case
  // every Chromebook reported "Unknown", exactly where the web
  // edition's save-path bug reports come from.
  if (ua.includes('CrOS')) return 'ChromeOS';
  if (ua.includes('Linux')) return 'Linux';
  return 'Unknown';
}
