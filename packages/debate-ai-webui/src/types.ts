/**
 * @fileoverview The contract between this package and whatever embeds it.
 *
 * A host (the browser extension's Options page today, a native wrapper or a
 * dev harness tomorrow) supplies an origin and, optionally, screens of its
 * own; everything else — the API client, the navigation, the styling — is the
 * package's. Keeping the shape here rather than in `DebateWebUI.tsx` means a
 * host can type its own screen without importing the shell.
 *
 * @module types
 */

import type { ReactNode } from "react";
import type { Client } from "debate-api-client";

/** What a screen is handed when it renders. */
export interface WebUIContext {
  /**
   * The `debate-api-client` client for the configured deployment. Screens pass
   * it as `{ client }` to an SDK call; they never construct one, so a host that
   * repoints the UI repoints every screen at once.
   */
  client: Client;
  /** The configured deployment origin, e.g. `https://debate-ai.com`. */
  origin: string;
  /**
   * Opens an in-app route (`/cards`, `/debate`) in the web app. Hosts that
   * cannot navigate their own page — an extension Options tab — open a new tab
   * instead; see {@link DebateWebUIProps.onOpenRoute}.
   */
  openRoute: (route: string) => void;
}

/** One entry in the UI's left-hand nav. */
export interface WebUIScreen {
  /** Stable id, used as the nav key and as `initialScreenId`'s value. */
  id: string;
  /** Nav label. */
  label: string;
  /** One line under the heading, describing what the screen is for. */
  description: string;
  /** Rendered when the screen is selected. */
  render: (context: WebUIContext) => ReactNode;
}

/** Props for the shell. */
export interface DebateWebUIProps {
  /**
   * Deployment to run against — an origin (`https://debate-ai.com`) or an API
   * base (`https://debate-ai.com/api`); both are accepted because the
   * extension's long-standing `apiBase` setting is documented as either.
   * Defaults to production.
   */
  origin?: string;
  /** Screen selected on first render. Defaults to the first screen. */
  initialScreenId?: string;
  /**
   * Screens appended after the built-in ones — how a host adds its own
   * settings without forking the shell.
   */
  extraScreens?: WebUIScreen[];
  /**
   * Opens an in-app route. Defaults to `window.open(siteUrl(origin, route))`,
   * which is what an embedded host (extension page, wrapper) wants; a host
   * rendering this inside the web app itself would route instead.
   */
  onOpenRoute?: (url: string, route: string) => void;
  /** Extra classes on the outer element. */
  className?: string;
}
