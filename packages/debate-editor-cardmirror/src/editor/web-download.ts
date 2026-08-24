/**
 * Web-edition header buttons: "Download the desktop app" + "GitHub".
 *
 * Both live in the ribbon's right-hand button grid (index.html) but start
 * hidden — `wireWebEditionHeaderButtons` reveals them (and widens the grid
 * to three columns) only when there's no Electron host, so the desktop app
 * never advertises its own installer.
 *
 * The download button auto-detects the platform + chip where the browser
 * can tell us (Chromium's `userAgentData.getHighEntropyValues` reports
 * `architecture`, which is the ONLY reliable Apple-Silicon signal — plain
 * `navigator.platform` says "MacIntel" on M-series Macs too). When the
 * answer is ambiguous (Safari/Firefox on a Mac, phones), it falls back to
 * a route-style picker with all four installers. Asset URLs come from the
 * GitHub releases API at click time (asset filenames embed the version,
 * so they can't be hardcoded); any API failure falls back to opening the
 * releases page.
 */

import { getElectronHost } from './host/index.js';
import { promptForRouteChoice } from './text-prompt.js';

const REPO_URL = 'https://github.com/ant981228/cardmirror';
// The LIST endpoint, newest first — NOT `/releases/latest`, which only
// serves full releases and returns nothing while every CardMirror
// release is marked pre-release (beta). Same reason the fallback page
// is `/releases`, not `/releases/latest`.
const LATEST_RELEASE_API =
  'https://api.github.com/repos/ant981228/cardmirror/releases?per_page=1';
const RELEASES_PAGE = `${REPO_URL}/releases`;

export type InstallerTarget = 'win-x64' | 'mac-arm64' | 'mac-x64' | 'linux-appimage';

export interface ReleaseAsset {
  name: string;
  browser_download_url: string;
}

/** The release asset for `target`, by extension + arch marker — robust to
 *  the version numbers electron-builder embeds in filenames. Extension
 *  checks also exclude the .blockmap/.yml update-metadata siblings. */
export function pickInstallerAsset(
  assets: ReleaseAsset[],
  target: InstallerTarget,
): ReleaseAsset | null {
  const find = (pred: (name: string) => boolean): ReleaseAsset | null =>
    assets.find((a) => pred(a.name.toLowerCase())) ?? null;
  switch (target) {
    case 'win-x64':
      return find((n) => n.endsWith('.exe'));
    // Both mac targets prefer the universal .dmg (single artifact since
    // the universal build landed — either chip runs it natively); the
    // per-arch patterns remain as fallback for older releases.
    case 'mac-arm64':
      return (
        find((n) => n.endsWith('.dmg') && n.includes('universal')) ??
        find((n) => n.endsWith('.dmg') && n.includes('arm64'))
      );
    case 'mac-x64':
      return (
        find((n) => n.endsWith('.dmg') && n.includes('universal')) ??
        find((n) => n.endsWith('.dmg') && !n.includes('arm64'))
      );
    case 'linux-appimage':
      return find((n) => n.endsWith('.appimage'));
  }
}

/** Everything detection reads, extracted for tests. */
export interface PlatformSignals {
  /** `navigator.platform` (legacy; "MacIntel" even on Apple Silicon). */
  platform?: string;
  /** `navigator.userAgent`. */
  userAgent?: string;
  /** `navigator.userAgentData?.platform` ("Windows" / "macOS" / …). */
  uaDataPlatform?: string;
  /** High-entropy `architecture` ("arm" / "x86"), when granted. */
  architecture?: string;
}

/** Best-effort target detection; null = ambiguous → show the picker.
 *  Phones/tablets are always null (no installer applies). */
export function detectInstallerTarget(signals: PlatformSignals): InstallerTarget | null {
  const ua = (signals.userAgent ?? '').toLowerCase();
  if (/android|iphone|ipad|ipod/.test(ua)) return null;
  const platform = (signals.uaDataPlatform ?? signals.platform ?? '').toLowerCase();
  if (platform.includes('win')) return 'win-x64'; // only 64-bit builds exist
  if (platform.includes('mac')) {
    if (signals.architecture === 'arm') return 'mac-arm64';
    if (signals.architecture === 'x86') return 'mac-x64';
    return null; // no architecture signal (Safari/Firefox) → ask
  }
  if (platform.includes('linux') || ua.includes('linux')) return 'linux-appimage';
  return null;
}

/** Current browser's signals, including the async high-entropy
 *  architecture hint where the API exists (Chromium). */
async function readBrowserSignals(): Promise<PlatformSignals> {
  const signals: PlatformSignals = {
    platform: navigator.platform,
    userAgent: navigator.userAgent,
  };
  const uaData = (
    navigator as Navigator & {
      userAgentData?: {
        platform?: string;
        getHighEntropyValues?: (hints: string[]) => Promise<{ architecture?: string }>;
      };
    }
  ).userAgentData;
  if (uaData) {
    signals.uaDataPlatform = uaData.platform ?? '';
    try {
      const high = await uaData.getHighEntropyValues?.(['architecture']);
      if (high?.architecture) signals.architecture = high.architecture;
    } catch {
      /* hint denied — fall back to the picker */
    }
  }
  return signals;
}

async function pickTargetViaDialog(): Promise<InstallerTarget | null> {
  return promptForRouteChoice<InstallerTarget>({
    message: 'Download the CardMirror desktop app — pick your platform:',
    choices: [
      { value: 'win-x64', label: 'Windows', description: 'Installer (.exe), 64-bit.' },
      {
        value: 'mac-arm64',
        label: 'macOS — Apple Silicon',
        description: 'For M-series Macs (2020 and later). (.dmg)',
      },
      { value: 'mac-x64', label: 'macOS — Intel', description: 'For Intel Macs. (.dmg)' },
      {
        value: 'linux-appimage',
        label: 'Linux',
        description: 'AppImage — Ubuntu and most other distros.',
      },
    ],
  });
}

/** Anchor-click navigation — reliable in installed-PWA windows where
 *  `window.open` can be blocked (see the multi-window spawn pattern).
 *  `newTab` for pages; downloads stay in-tab (the asset URL's
 *  content-disposition makes it a download, not a navigation). */
function clickThrough(url: string, opts?: { newTab?: boolean }): void {
  const a = document.createElement('a');
  a.href = url;
  if (opts?.newTab) {
    a.target = '_blank';
    a.rel = 'noopener';
  }
  document.body.appendChild(a);
  a.click();
  a.remove();
}

async function startInstallerDownload(): Promise<void> {
  let target = detectInstallerTarget(await readBrowserSignals());
  if (!target) {
    target = await pickTargetViaDialog();
    if (!target) return; // cancelled
  }
  try {
    const res = await fetch(LATEST_RELEASE_API, {
      headers: { accept: 'application/vnd.github+json' },
    });
    if (!res.ok) throw new Error(`GitHub API ${res.status}`);
    const releases = (await res.json()) as Array<{ assets?: ReleaseAsset[] }>;
    const asset = pickInstallerAsset(releases[0]?.assets ?? [], target);
    if (!asset) throw new Error(`no ${target} asset in the latest release`);
    clickThrough(asset.browser_download_url);
  } catch (err) {
    // Rate-limited / offline / asset naming drifted — the releases page
    // always works as the manual fallback.
    console.warn('Installer download fell back to the releases page:', err);
    clickThrough(RELEASES_PAGE, { newTab: true });
  }
}

/** Reveal + wire the web-only header buttons; on the desktop app
 *  (Electron host present) REMOVE them from the DOM instead. Removal,
 *  not just `hidden`: the `hidden` attribute is fragile under the
 *  ribbon's own `display` rules (author CSS beats the UA sheet's
 *  `[hidden]{display:none}` — the 0.1.0-beta.14 field bug shipped
 *  these buttons visible in the desktop build exactly that way), and
 *  a node that isn't there can't be resurrected by any styling.
 *  Call once at boot. */
export function wireWebEditionHeaderButtons(): void {
  const grid = document.querySelector('.ribbon-right-grid');
  const downloadBtn = document.getElementById('download-app-btn');
  const githubBtn = document.getElementById('github-btn');
  if (!grid || !downloadBtn || !githubBtn) return;
  if (getElectronHost()) {
    downloadBtn.remove();
    githubBtn.remove();
    return;
  }
  grid.classList.add('pmd-web-buttons');
  downloadBtn.hidden = false;
  githubBtn.hidden = false;
  downloadBtn.addEventListener('click', () => void startInstallerDownload());
  githubBtn.addEventListener('click', () => clickThrough(REPO_URL, { newTab: true }));
}
