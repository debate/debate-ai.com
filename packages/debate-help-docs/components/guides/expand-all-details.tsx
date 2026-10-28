"use client"
/**
 * @file expand-all-details.tsx
 * @description A button that opens or closes every `<details>` element on the
 * page at once. Used by long reference lists whose entries collapse.
 * Registered in `mdx-components.tsx` so MDX pages can use it directly.
 */
import { useState } from "react"

/** Toggles all `<details>` elements on the current page. */
export function ExpandAllDetails() {
  const [open, setOpen] = useState(false)
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
