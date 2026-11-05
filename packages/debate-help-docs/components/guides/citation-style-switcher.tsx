"use client"
/**
 * @file citation-style-switcher.tsx
 * @description The "Citation style" dropdown on a References page: Chicago
 * (how the entries are written, and the default), APA, MLA or Harvard.
 * Registered in `mdx-components.tsx`; a References page places it beside
 * `<ExpandAllDetails />`.
 *
 * Picking a style rewrites each entry's bibliography line on the page — the
 * `<summary>` of every `<details>` card in the list — through
 * `formatCitation` (`lib/citation-styles.ts`). The Chicago HTML is kept on
 * the element (`data-cite-chicago`) so switching back, or to another style,
 * always starts from what the page was authored with. The card bodies are
 * not touched.
 *
 * The choice is stored per browser and shared through `useCitationStyle`,
 * so it carries to the other References page and to the in-text citation
 * hover cards (`citation-card.tsx`).
 */
import { useCallback, useEffect, useId, useRef, useState, useSyncExternalStore } from "react"
import { Check, ChevronDown, Quote } from "lucide-react"
import { cn } from "../../lib/utils"
import { buttonVariants } from "../ui/button"
import {
  CITATION_STYLES,
  CITATION_STYLE_LABELS,
  DEFAULT_CITATION_STYLE,
  formatCitation,
  isCitationStyle,
  type CitationStyle,
} from "../../lib/citation-styles"

const STORAGE_KEY = "debate-docs-citation-style"
const CHANGE_EVENT = "debate-docs-citation-style-change"

function readStyle(): CitationStyle {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    return isCitationStyle(stored) ? stored : DEFAULT_CITATION_STYLE
  } catch {
    return DEFAULT_CITATION_STYLE
  }
}

let current: CitationStyle | undefined

function getSnapshot(): CitationStyle {
  current ??= readStyle()
  return current
}

function subscribe(onChange: () => void): () => void {
  const onStorage = (event: StorageEvent) => {
    if (event.key !== STORAGE_KEY) return
    current = readStyle()
    onChange()
  }
  window.addEventListener(CHANGE_EVENT, onChange)
  window.addEventListener("storage", onStorage)
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange)
    window.removeEventListener("storage", onStorage)
  }
}

/** Stores the reader's style and tells every switcher and hover card. */
export function setCitationStyle(style: CitationStyle) {
  current = style
  try {
    localStorage.setItem(STORAGE_KEY, style)
  } catch {
    // Private mode or blocked storage: the choice lasts for this page only.
  }
  window.dispatchEvent(new Event(CHANGE_EVENT))
}

/** The reader's citation style; Chicago on the server and until hydrated. */
export function useCitationStyle(): CitationStyle {
  return useSyncExternalStore(subscribe, getSnapshot, () => DEFAULT_CITATION_STYLE)
}

/** Rewrites every reference entry inside `root` in `style`. */
function applyStyle(root: ParentNode, style: CitationStyle) {
  root.querySelectorAll<HTMLElement>("ol > li > details > summary").forEach((summary) => {
    const chicago = summary.dataset.citeChicago ?? summary.innerHTML
    summary.dataset.citeChicago = chicago
    const next = formatCitation(chicago, style)
    if (summary.innerHTML !== next) summary.innerHTML = next
  })
}

/** Dropdown that switches the References list between citation styles. */
export function CitationStyleSwitcher() {
  const style = useCitationStyle()
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const menuId = useId()

  useEffect(() => {
    const page = rootRef.current?.closest("article") ?? document
    applyStyle(page, style)
  }, [style])

  useEffect(() => {
    if (!open) return
    const onPointer = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false)
    }
    document.addEventListener("pointerdown", onPointer)
    document.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("pointerdown", onPointer)
      document.removeEventListener("keydown", onKey)
    }
  }, [open])

  const choose = useCallback((next: CitationStyle) => {
    setCitationStyle(next)
    setOpen(false)
  }, [])

  return (
    <div ref={rootRef} className="not-prose relative mb-4 mr-2 inline-block align-top">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        title="Change the citation style of the references"
        className={cn(
          buttonVariants({
            size: "sm",
            className: "gap-2 border [&_svg]:size-3.5 [&_svg]:text-fd-muted-foreground",
          }),
        )}
        onClick={() => setOpen((value) => !value)}
      >
        <Quote />
        {CITATION_STYLE_LABELS[style]}
        <ChevronDown className={cn("transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div
          id={menuId}
          role="menu"
          aria-label="Citation style"
          className="absolute left-0 top-full z-20 mt-1 min-w-36 rounded-md border bg-fd-popover p-1 text-sm text-fd-popover-foreground shadow-md"
        >
          {CITATION_STYLES.map((option) => (
            <button
              key={option}
              type="button"
              role="menuitemradio"
              aria-checked={option === style}
              className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left hover:bg-fd-accent focus-visible:bg-fd-accent focus-visible:outline-none"
              onClick={() => choose(option)}
            >
              <Check className={cn("size-3.5", option === style ? "opacity-100" : "opacity-0")} />
              {CITATION_STYLE_LABELS[option]}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
