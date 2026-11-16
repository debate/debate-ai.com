"use client"
/**
 * @file moved-anchors.tsx
 * @description Forwards old `#section` links after a page was split in two.
 * A server redirect never sees the URL fragment, so `/docs/learn/ld-ethics`
 * 308s to the general Framework page and this component, placed on that page,
 * sends the sections that moved (`#kant`, `#utilitarianism`, …) on to the page
 * that now holds them. Renders nothing. Registered in `mdx-components.tsx`.
 */
import { useEffect } from "react"

/** Returns where `hash` now lives, or null when it stays on this page. */
export function movedAnchorTarget(hash: string, to: string, ids: readonly string[]): string | null {
  const id = decodeURIComponent(hash.replace(/^#/, ""))
  return id && ids.includes(id) ? `${to}#${encodeURIComponent(id)}` : null
}

/** On load and on hash change, replaces the URL when its `#id` moved to `to`. */
export function MovedAnchors({ to, ids }: { to: string; ids: string[] }) {
  useEffect(() => {
    const forward = () => {
      const target = movedAnchorTarget(window.location.hash, to, ids)
      if (target) window.location.replace(target)
    }
    forward()
    window.addEventListener("hashchange", forward)
    return () => window.removeEventListener("hashchange", forward)
  }, [to, ids])
  return null
}
