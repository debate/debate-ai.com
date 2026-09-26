/**
 * @fileoverview What differs about the page the UI is mounted in.
 *
 * The same shell runs as debate-ai.com (under Next, served from the Worker)
 * and inside other hosts such as the browser extension's Options page. A few
 * things the website does are only possible on its own origin:
 *
 * - **Frames.** The dock loads each destination into a same-origin `<iframe>`
 *   of the site's own URL (`AppFrameProvider`). An extension page has no
 *   server behind its origin to frame.
 * - **Google One Tap** loads Google's script into the page, which an MV3
 *   extension page's CSP refuses.
 * - **The offline service worker** is served from the site's root.
 * - **Sign-in** is a cookie on the site's origin. A host on another origin
 *   has to run its own handoff (the extension's is a tab to
 *   `/auth/extension-complete`) and hold its own session.
 *
 * Hosts call {@link configureHost} once, before rendering. The web app never
 * does, so every default below is what debate-ai.com itself does.
 *
 * This is module state rather than React context because two of its readers
 * run outside any component: the auth client and the frame helpers are
 * evaluated at import time or called from event handlers.
 */

export interface HostConfig {
  /** Load dock destinations into same-origin frames. Web only. */
  framing: boolean
  /** Show Google One Tap. Needs Google's script, so web only. */
  oneTap: boolean
  /** Register the offline service worker. Web only. */
  serviceWorker: boolean
  /**
   * Starts sign-in outside the page. When set, every sign-in form renders a
   * single button that calls this instead of its email and Google controls.
   */
  signIn?: () => void
  /**
   * Opens a URL on the website itself, in whatever way the host prefers
   * (a new tab, from an extension page). Used for the few pages that only
   * work on the site's own origin.
   */
  openOnSite?: (path: string) => void
}

const WEB_DEFAULTS: HostConfig = {
  framing: true,
  oneTap: true,
  serviceWorker: true,
}

let current: HostConfig = WEB_DEFAULTS

/** Sets what this host supports. Call once, before the first render. */
export function configureHost(overrides: Partial<HostConfig>): void {
  current = { ...WEB_DEFAULTS, ...overrides }
}

/** What the current host supports. */
export function getHostConfig(): HostConfig {
  return current
}
