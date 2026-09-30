"use client"

/**
 * @fileoverview "Is this document running inside someone else's frame?"
 *
 * The app renders every page, dock destinations included, as React in one
 * document; it never frames itself. But another page can frame it (an embed
 * on a partner site, a browser extension panel), and then the app should
 * render only the page: no dock, sidebar or player of its own inside that
 * frame. A cross-origin parent throws on access, which can only mean we are
 * framed.
 *
 * Returns `false` on the server and for the first client render, so markup
 * matches on hydration; the pre-paint script in the root layout sets
 * `data-embedded` on <html> for the same condition, and the CSS rule in
 * `globals.css` hides `[data-app-chrome]` until this settles — so nothing
 * flashes in the gap.
 */

import { useEffect, useState } from "react"

export function useIsFramedDocument(): boolean {
  const [framed, setFramed] = useState(false)

  useEffect(() => {
    try {
      setFramed(window.self !== window.top)
    } catch {
      setFramed(true)
    }
  }, [])

  return framed
}
