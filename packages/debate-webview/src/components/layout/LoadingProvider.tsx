"use client"

/**
 * @fileoverview Mounts the app's loading indicators and wires the route one
 * to the router.
 *
 * Page transitions show the {@link RouteProgressBar} across the top of the
 * viewport — the app's standard transition pattern. The full-screen
 * {@link LoadingOverlay} stays for code that asks for it with `beginLoading`;
 * it renders null until then, so pages that never use it pay for nothing.
 *
 * Drop this once in the root layout, above the app shell, so both sit over
 * the dock, the sidebar and every page.
 */

import { LoadingOverlay } from "../ui/LoadingOverlay"
import { RouteProgressBar } from "../ui/RouteProgressBar"
import {
  useLoadingStore,
  DEFAULT_LOADING_FADE_OUT_MS,
  DEFAULT_LOADING_SHOW_DELAY_MS,
} from "../../lib/ui/loading-store"
import { useRouteLoading } from "../../lib/ui/use-route-loading"

export function LoadingProvider() {
  // Arms the progress bar the moment any page transition starts — a link
  // click, a dock item, back/forward — and finishes it once the new route has
  // painted. It only shows if that takes longer than the show delay.
  useRouteLoading()

  const isActive = useLoadingStore((s) => s.isActive)
  const label = useLoadingStore((s) => s.label)
  const passthrough = useLoadingStore((s) => s.passthrough)

  // The overlay is a client-only layer: on the server it renders nothing, so
  // the first paint is the page itself and the orb only appears once the
  // client bundle hydrates and something asks for it.
  return (
    <>
      <RouteProgressBar />
      <LoadingOverlay
        active={isActive}
        label={label ?? undefined}
        fadeOutMs={DEFAULT_LOADING_FADE_OUT_MS}
        showDelayMs={DEFAULT_LOADING_SHOW_DELAY_MS}
        passthrough={passthrough}
      />
    </>
  )
}