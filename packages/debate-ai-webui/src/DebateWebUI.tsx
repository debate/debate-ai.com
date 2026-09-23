/**
 * @fileoverview The shell: the whole debate-ai.com frontend UI as one
 * component a host can mount.
 *
 * Everything a page normally supplies — routing, the API client, the styling —
 * is the shell's, because the hosts are pages that have none of it. The
 * browser extension's Options page is a `chrome-extension://` document with no
 * router and no session; a native wrapper is a `file://` one. So the shell
 * keeps the selected screen in state rather than in a URL, builds one
 * `debate-api-client` client from the configured origin and hands it to every
 * screen, and opens in-app routes in the real deployment via
 * {@link DebateWebUIProps.onOpenRoute}.
 *
 * `origin` is what makes it embeddable more than once: two hosts pointed at a
 * production and a local deployment are two mounts of this component, not two
 * builds of it.
 *
 * @module DebateWebUI
 */

import { useMemo, useState } from "react";

import { createWebUiClient, siteUrl } from "./api";
import { BUILT_IN_SCREENS } from "./screens";
import type { DebateWebUIProps, WebUIContext, WebUIScreen } from "./types";

/**
 * Renders the app UI: a screen list down the side, the selected screen beside
 * it, and a footer linking out to the deployment it is talking to.
 *
 * @param props - See {@link DebateWebUIProps}.
 */
export function DebateWebUI({
  origin,
  initialScreenId,
  extraScreens,
  onOpenRoute,
  className,
}: DebateWebUIProps) {
  const screens: WebUIScreen[] = useMemo(
    () => [...BUILT_IN_SCREENS, ...(extraScreens ?? [])],
    [extraScreens],
  );

  const [activeId, setActiveId] = useState(
    () => initialScreenId ?? screens[0]?.id ?? "",
  );

  // A host that repoints `origin` gets a new client, and with it a new grab
  // cache and dedupe scope — which is the behaviour you want when the answer
  // to "has this been cut?" is per deployment.
  const client = useMemo(() => createWebUiClient(origin), [origin]);

  const context: WebUIContext = useMemo(
    () => ({
      client,
      origin: siteUrl(origin, "/"),
      openRoute: (route) => {
        const url = siteUrl(origin, route);
        if (onOpenRoute) {
          onOpenRoute(url, route);
          return;
        }
        // The default a host without its own routing wants: the app, in a tab
        // of its own. `noopener` because the opened page must not reach back
        // into an extension page through `window.opener`.
        globalThis.open?.(url, "_blank", "noopener,noreferrer");
      },
    }),
    [client, origin, onOpenRoute],
  );

  // A host may pass an `initialScreenId` that no longer exists, or drop the
  // extra screen that was selected; falling back keeps the panel from going
  // blank instead of showing the first screen.
  const active = screens.find((screen) => screen.id === activeId) ?? screens[0];

  if (!active) return null;

  return (
    <div className={className ? `dai-root ${className}` : "dai-root"}>
      <nav className="dai-nav" aria-label="Debate AI sections">
        <span className="dai-brand">Debate AI</span>
        <ul className="dai-nav-list">
          {screens.map((screen) => (
            <li key={screen.id}>
              <button
                type="button"
                className={
                  screen.id === active.id ? "dai-nav-item dai-nav-item-active" : "dai-nav-item"
                }
                aria-current={screen.id === active.id ? "page" : undefined}
                onClick={() => setActiveId(screen.id)}
              >
                {screen.label}
              </button>
            </li>
          ))}
        </ul>
        <a
          className="dai-nav-origin"
          href={context.origin}
          target="_blank"
          rel="noreferrer noopener"
          title="Open this deployment in a new tab"
        >
          {hostLabel(context.origin)}
        </a>
      </nav>

      <main className="dai-main">
        <header className="dai-header">
          <h2 className="dai-title">{active.label}</h2>
          <p className="dai-subtitle">{active.description}</p>
        </header>
        {active.render(context)}
      </main>
    </div>
  );
}

/** `https://debate-ai.com/` → `debate-ai.com`, for the nav's footer link. */
function hostLabel(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}
