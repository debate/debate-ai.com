"use client"

import { useLayoutEffect, useState, type ReactNode } from "react"
import { QWKSEARCH_API_BASE } from "./base-url"

/**
 * Scopes grab-url's page-wide default base URL to the qwksearch embed.
 *
 * research-agent-ui's grab-url calls (`agent/providers`, `agent/voice`,
 * `agent/transcript`, chat titles, suggestions, `doc/article`) resolve
 * against `window.grab.defaults.baseURL`, which defaults to same-origin
 * `/api/` — routes debate-ai.com doesn't serve. `grab.defaults` is a
 * page-wide singleton shared with debate's own packages (e.g. the video
 * library's `/api/videos` fetch), so the qwksearch base URL must be applied
 * only while the embed is mounted and undone on unmount.
 *
 * Children are withheld until the default is applied: child effects run
 * before this component's own effect would, so rendering them immediately
 * could let an early mount-time `grab()` (e.g. the providers fetch in
 * chatConfig) race ahead and resolve against the wrong origin.
 */
export function GrabBaseScope({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false)

  useLayoutEffect(() => {
    const win = window as unknown as {
      grab?: { defaults?: Record<string, unknown> }
    }
    win.grab = win.grab || {}
    const previousDefaults = win.grab.defaults
    win.grab.defaults = {
      ...previousDefaults,
      baseURL: QWKSEARCH_API_BASE,
    }
    setReady(true)
    return () => {
      if (win.grab) win.grab.defaults = previousDefaults ?? {}
    }
  }, [])

  return ready ? <>{children}</> : null
}
