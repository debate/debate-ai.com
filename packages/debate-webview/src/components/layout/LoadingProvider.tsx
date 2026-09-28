"use client"

/**
 * @fileoverview Mounts the global {@link LoadingOverlay} and wires it to the
 * router.
 *
 * Drop this once in the root layout, above the app shell, so the overlay
 * covers the dock, the sidebar and every framed destination. It is a no-op
 * when nothing has asked to load — the overlay renders null until the first
 * `beginLoading`, so pages that never use it pay for nothing.
 */

import { LoadingOverlay } from "../ui/LoadingOverlay"
import {
  useLoadingStore,
  DEFAULT_LOADING_FADE_OUT_MS,
  DEFAULT_LOADING_SHOW_DELAY_MS,
} from "../../lib/ui/loading-store"
import { useRouteLoading } from "../../lib/ui/use-route-loading"

export function LoadingProvider() {
  // Arms the orb the moment any page transition starts — a link click,
  // back/forward, a framed page handing a navigation up — and drops it once
  // the new route has painted. It only shows if that takes longer than the
  // show delay.
  useRouteLoading()

  const isActive = useLoadingStore((s) => s.isActive)
  const label = useLoadingStore((s) => s.label)
  const passthrough = useLoadingStore((s) => s.passthrough)

  // The overlay is a client-only layer: on the server it renders nothing, so
  // the first paint is the page itself and the orb only appears once the
  // client bundle hydrates and a transition asks for it.
  return (
    <LoadingOverlay
      active={isActive}
      label={label ?? undefined}
      fadeOutMs={DEFAULT_LOADING_FADE_OUT_MS}
      showDelayMs={DEFAULT_LOADING_SHOW_DELAY_MS}
      passthrough={passthrough}
    />
  )
}