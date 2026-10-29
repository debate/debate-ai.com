"use client"
/**
 * @file expand-all-details.tsx
 * @description A button that opens or closes every `<details>` element on the
 * page at once. Used by long reference lists whose entries collapse.
 * Registered in `mdx-components.tsx` so MDX pages can use it directly.
 *
 * It also opens the entry a link points at: a citation hover card links to
 * `references#ref-…` (`lib/mdx/rehype-citation-cards.ts`), and that entry's
 * card should be showing, not collapsed, when the page lands on it.
 */
import { useEffect, useState } from "react"

/** Opens the `<details>` at or inside the URL's `#target`, and scrolls to it. */
function openHashTarget() {
  const id = decodeURIComponent(window.location.hash.slice(1))
  if (!id) return
  const target = document.getElementById(id)
  const details = target instanceof HTMLDetailsElement ? target : target?.querySelector("details")
  if (!target || !details) return
  details.open = true
  target.scrollIntoView({ block: "start" })
}

/** Toggles all `<details>` elements on the current page. */
export function ExpandAllDetails() {
  const [open, setOpen] = useState(false)
  useEffect(() => {
    openHashTarget()
    window.addEventListener("hashchange", openHashTarget)
    return () => window.removeEventListener("hashchange", openHashTarget)
  }, [])
  const toggle = () => {
    const next = !open
    document.querySelectorAll("details").forEach((d) => {
      d.open = next
    })
    setOpen(next)
  }
  return (
    <button
      type="button"
      onClick={toggle}
      className="not-prose mb-4 rounded-md border px-3 py-1.5 text-sm hover:bg-fd-accent"
    >
      {open ? "Collapse all" : "Expand all"}
    </button>
  )
}
