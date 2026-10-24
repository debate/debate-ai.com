/**
 * @fileoverview Installer links for the desktop app (`apps/debate-native-wrapper`),
 * as data the features page's downloads row renders.
 *
 * The Chrome extension comes first, in its own box with
 * {@link EXTENSION_DOWNLOAD_FEATURES}; the app installers follow.
 *
 * Every link points at an asset of one GitHub release. Bump
 * `DESKTOP_RELEASE_TAG` and the file names together when a new wrapper
 * release ships.
 *
 * @module features/desktop-downloads
 */

/** The wrapper version these links install. */
export const DESKTOP_VERSION = "1.0.0";

/** The GitHub release tag the installers are attached to. */
export const DESKTOP_RELEASE_TAG = `native-wrapper-v${DESKTOP_VERSION}`;

const RELEASE_BASE = `https://github.com/debate/debate-ai.com/releases/download/${DESKTOP_RELEASE_TAG}`;

/** The release page, for anyone after checksums or release notes. */
export const DESKTOP_RELEASE_URL = `https://github.com/debate/debate-ai.com/releases/tag/${DESKTOP_RELEASE_TAG}`;

/** One installer format for one OS. */
export interface DesktopInstaller {
  /** Short format label, e.g. ".dmg". */
  label: string;
  /** Direct download URL of the release asset. */
  href: string;
}

/** One OS's installers; the first is the one the main button downloads. */
export interface DesktopPlatform {
  /** Stable key, also used as the button's test id suffix. */
  id: "windows" | "macos" | "linux";
  /** OS name shown on the button. */
  name: string;
  installers: DesktopInstaller[];
}

/** Windows, macOS and Linux installers, recommended format first. */
export const DESKTOP_DOWNLOADS: DesktopPlatform[] = [
  {
    id: "windows",
    name: "Windows",
    installers: [
      { label: ".exe", href: `${RELEASE_BASE}/Debate.AI_${DESKTOP_VERSION}_x64-setup.exe` },
      { label: ".msi", href: `${RELEASE_BASE}/Debate.AI_${DESKTOP_VERSION}_x64_en-US.msi` },
    ],
  },
  {
    id: "macos",
    name: "macOS",
    installers: [
      { label: ".dmg", href: `${RELEASE_BASE}/Debate.AI_${DESKTOP_VERSION}_universal.dmg` },
      { label: ".app.tar.gz", href: `${RELEASE_BASE}/Debate.AI_universal.app.tar.gz` },
    ],
  },
  {
    id: "linux",
    name: "Linux",
    installers: [
      { label: ".AppImage", href: `${RELEASE_BASE}/Debate.AI_${DESKTOP_VERSION}_amd64.AppImage` },
      { label: ".deb", href: `${RELEASE_BASE}/Debate.AI_${DESKTOP_VERSION}_amd64.deb` },
      { label: ".rpm", href: `${RELEASE_BASE}/Debate.AI-${DESKTOP_VERSION}-1.x86_64.rpm` },
    ],
  },
];

/** What only the Chrome extension does, listed in its box above the app downloads. */
export const EXTENSION_DOWNLOAD_FEATURES = [
  {
    title: "Read cards on the page",
    detail: "Open any article, PDF or YouTube transcript in a reading panel right on the page, highlight it, and ask the AI about it.",
  },
  {
    title: "Offline local app",
    detail: "\"Open Debate AI (local)\" runs the editor and Research docs bundled inside the extension, no website tab needed.",
  },
  {
    title: "Already cut?",
    detail: "The popup checks the page against your team's cards and the caselist library.",
  },
  {
    title: "Search any selection",
    detail: "Select text and press ` to search it on Debate AI cards, Google Scholar, News and more.",
  },
] as const;
