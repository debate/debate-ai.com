/**
 * @fileoverview The hook a host uses to run "Sign in with QwkSearch" itself.
 *
 * The browser extension's Options page has no `/api` of its own to navigate
 * to, so it hands over a function that runs the flow another way. The app
 * shell registers it here (`debate-webview`'s `configureHost`) rather than this
 * package reading the shell's config, and it stays in its own file so the shell
 * can import it without pulling in the auth client.
 */

/** What a host-run connect flow resolves to. */
export interface HostConnectResult {
  ok: boolean
  /** The reader closed the tab or chose Cancel on QwkSearch. */
  cancelled?: boolean
  /** Why it failed, when the host knows. */
  error?: string
}

let hostConnect: (() => Promise<HostConnectResult>) | undefined

/** Registers (or, with no argument, clears) the host's connect flow. */
export function setHostConnectQwkSearch(connect?: () => Promise<HostConnectResult>): void {
  hostConnect = connect
}

export function getHostConnectQwkSearch(): (() => Promise<HostConnectResult>) | undefined {
  return hostConnect
}
