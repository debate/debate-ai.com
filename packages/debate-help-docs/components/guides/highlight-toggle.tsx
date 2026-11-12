"use client"
/**
 * @file highlight-toggle.tsx
 * @description The "Underlining" button on the Synergy Slayer of Critiques
 * pages. It shows or hides the policy-style highlighting authored into the MDX
 * as `==text==` (`lib/mdx/remark-debate-highlight.ts`) in the page prose, the
 * way a debater reads only the marked words of a card. The quoted excerpts in
 * the References cards and the citation hover tooltips keep their underlining
 * and highlighting either way. Other docs pages have no highlights and no
 * button.
 *
 * The choice is stored per browser, so it carries across every Synergy Slayer
 * page, and applied as `data-debate-highlights` on `<html>`; `styles/docs.css`
 * keys the styling off it, inside `.synergy-slayer-doc` only. Highlights are
 * on unless the reader turned them off.
 * `HIGHLIGHT_INIT_SCRIPT` applies a stored "off" before first paint, so a
 * reader who turned them off never sees them flash on. Reading mode
 * (`reading-mode.tsx`) shows a second copy of the button; the two stay in step.
 */
import { useEffect, useState } from "react"
import { Underline } from "lucide-react"
import { cn } from "../../lib/utils"
import { buttonVariants } from "../ui/button"

const STORAGE_KEY = "debate-docs-highlights"
const ATTRIBUTE = "data-debate-highlights"
/** Fired on `window` when the choice changes, so the page's and reading mode's buttons agree. */
const CHANGE_EVENT = "debate-docs-highlights-change"

/** Inline script for the docs layout: restores a stored "off" before paint. */
export const HIGHLIGHT_INIT_SCRIPT = `try{if(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})==="off")document.documentElement.setAttribute(${JSON.stringify(ATTRIBUTE)},"off")}catch(e){}`

function readStored(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) !== "off"
  } catch {
    return true
  }
}

/** Toggles the prose underlining and highlights on the Synergy Slayer pages. */
export function HighlightToggle() {
  const [on, setOn] = useState(true)

  useEffect(() => {
    const stored = readStored()
    setOn(stored)
    // Hydrating <html> can drop the attribute HIGHLIGHT_INIT_SCRIPT set, which
    // left the button saying "off" over a page still showing highlights.
    document.documentElement.setAttribute(ATTRIBUTE, stored ? "on" : "off")
    const onChange = () => setOn(document.documentElement.getAttribute(ATTRIBUTE) !== "off")
    window.addEventListener(CHANGE_EVENT, onChange)
    return () => window.removeEventListener(CHANGE_EVENT, onChange)
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
    window.dispatchEvent(new Event(CHANGE_EVENT))
  }

  return (
    <button
      type="button"
      aria-pressed={on}
      title={on ? "Hide the underlining and highlighting in the text" : "Show the underlining and highlighting in the text"}
      className={cn(
        buttonVariants({
          size: "sm",
          className: "gap-2 [&_svg]:size-3.5 [&_svg]:text-fd-muted-foreground",
        }),
        on && "bg-fd-accent text-fd-accent-foreground hover:bg-fd-accent/80",
      )}
      onClick={toggle}
    >
      <Underline />
      Underlining {on ? "on" : "off"}
    </button>
  )
}
