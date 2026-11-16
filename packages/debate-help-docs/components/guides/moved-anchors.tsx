"use client"
/**
 * @file moved-anchors.tsx
 * @description Forwards old `#section` links after a page was split in two.
 * A server redirect never sees the URL fragment, so the split-off sections
 * need a client hop. Placed on `/docs/learn/ld-ethics` (now the LD
 * Philosophers page), it sends any `#id` that page no longer has (`#determinism`,
 * `#answering-1`, …) on to `/docs/learn/ld-framework`, which holds them now.
 * Renders nothing. Registered in `mdx-components.tsx`.
 */
import { useEffect } from "react"

/**
 * Returns where `hash` now lives, or null when it stays on this page.
 * `hasId` says whether this page still has an element with that id.
 */
export function movedAnchorTarget(hash: string, to: string, hasId: (id: string) => boolean): string | null {
  const id = decodeURIComponent(hash.replace(/^#/, ""))
  return id && !hasId(id) ? `${to}#${encodeURIComponent(id)}` : null
}

/** On load and on hash change, replaces the URL when its `#id` is not on this page. */
export function MovedAnchors({ to }: { to: string }) {
  useEffect(() => {
    const forward = () => {
      const target = movedAnchorTarget(window.location.hash, to, (id) => document.getElementById(id) !== null)
      if (target) window.location.replace(target)
    }
    forward()
    window.addEventListener("hashchange", forward)
    return () => window.removeEventListener("hashchange", forward)
  }, [to])
  return null
}
