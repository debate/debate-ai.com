"use client"
/**
 * @file highlight-toggle.tsx
 * @description The "Highlights" button on every docs page. It shows or hides
 * the policy-style highlighting authored into the MDX as `==text==`
 * (`lib/mdx/remark-debate-highlight.ts`), the way a debater reads only the
 * highlighted words of a card.
 *
 * The choice is stored per browser and applied as `data-debate-highlights` on
 * `<html>`; `styles/docs.css` keys the `<mark class="debate-hl">` colour off
 * it. Highlights are on unless the reader turned them off.
 * `HIGHLIGHT_INIT_SCRIPT` applies a stored "off" before first paint, so a
 * reader who turned them off never sees them flash on.
 */
import { useEffect, useState } from "react"
import { Highlighter } from "lucide-react"
import { cn } from "../../lib/utils"
import { buttonVariants } from "../ui/button"

const STORAGE_KEY = "debate-docs-highlights"
const ATTRIBUTE = "data-debate-highlights"

/** Inline script for the docs layout: restores a stored "off" before paint. */
export const HIGHLIGHT_INIT_SCRIPT = `try{if(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})==="off")document.documentElement.setAttribute(${JSON.stringify(ATTRIBUTE)},"off")}catch(e){}`

function readStored(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) !== "off"
  } catch {
    return true
  }
}

/** Toggles the authored debate highlights on the current docs page. */
export function HighlightToggle() {
  const [on, setOn] = useState(true)

  useEffect(() => {
    setOn(readStored())
  }, [])

  const toggle = () => {
    const next = !on
    setOn(next)
    document.documentElement.setAttribute(ATTRIBUTE, next ? "on" : "off")
    try {
      localStorage.setItem(STORAGE_KEY, next ? "on" : "off")
    } catch {
      // Private mode or blocked storage: the choice lasts for this page only.
    }
  }

  return (
    <button
      type="button"
      aria-pressed={on}
      title={on ? "Hide the highlighted key points" : "Highlight the key points"}
      className={cn(
        buttonVariants({
          size: "sm",
          className: "gap-2 [&_svg]:size-3.5 [&_svg]:text-fd-muted-foreground",
        }),
        on && "bg-fd-accent",
      )}
      onClick={toggle}
    >
      <Highlighter />
      Highlights {on ? "on" : "off"}
    </button>
  )
}
