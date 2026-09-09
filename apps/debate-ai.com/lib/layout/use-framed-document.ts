"use client"

/**
 * @fileoverview "Is this document running inside the app shell's frame?"
 *
 * The shell keeps the dock, the tool sidebar and the persistent player in the
 * top document and loads each dock destination into a same-origin frame
 * beneath them (see `components/layout/AppFrameProvider.tsx`). Anything that
 * belongs to the shell has to know not to render a second copy of itself
 * inside that frame.
 *
 * Deliberately not read from the `?embed=1` marker on the frame's URL:
 * `useSearchParams` this high in the tree would opt the whole app out of
 * static rendering, and the marker is lost the moment the framed page
 * navigates within itself. The frame relationship survives both. A
 * cross-origin parent throws on access, which can only mean we are framed.
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
