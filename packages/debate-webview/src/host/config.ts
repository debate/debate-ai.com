/**
 * @fileoverview What differs about the page the UI is mounted in.
 *
 * The same shell runs as debate-ai.com (under Next, served from the Worker)
 * and inside other hosts such as the browser extension's Options page. A few
 * things the website does are only possible on its own origin:
 *
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

import type { ComponentType } from "react"
import { setHostConnectQwkSearch, type HostConnectResult } from "@debate-ai/qwksearch/components/host-connect"

/**
 * One more tab in the app's Settings page, supplied by the host — the browser
 * extension's own settings (timer, toolbar, reading mode, search shortcut)
 * live here, beside the app's, rather than on a separate screen.
 */
export interface HostSettingsSection {
  /** Tab id, also its `?category=` value. Must not collide with the app's own. */
  id: string
  label: string
  /** The subtitle under the tab's heading; also matched by the settings search. */
  description: string
  icon?: ComponentType<{ size?: number }>
  /** The tab's content. */
  component: ComponentType
}

export type { HostConnectResult }

export interface HostConfig {
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
  /**
   * Runs "Sign in with QwkSearch" outside the page. The web flow navigates
   * this page to `/api/qwksearch/connect`, which only exists on the site's
   * own origin and needs its cookie; a host elsewhere (the extension) runs
   * the consent tab itself and resolves once the QwkSearch account is linked
   * to the signed-in debate-ai account, or with why it isn't.
   */
  connectQwkSearch?: () => Promise<HostConnectResult>
  /** Extra Settings tabs the host owns, listed after the app's Preferences and My team. */
  settingsSections?: HostSettingsSection[]
}

const WEB_DEFAULTS: HostConfig = {
  oneTap: true,
  serviceWorker: true,
}

let current: HostConfig = WEB_DEFAULTS

/** Sets what this host supports. Call once, before the first render. */
export function configureHost(overrides: Partial<HostConfig>): void {
  current = { ...WEB_DEFAULTS, ...overrides }
  setHostConnectQwkSearch(current.connectQwkSearch)
}

/** What the current host supports. */
export function getHostConfig(): HostConfig {
  return current
}
