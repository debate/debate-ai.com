"use client"
/**
 * @file references-panel.tsx
 * @description The "References" button on the Synergy Slayer pages and the
 * right-hand side panel it opens: every citation hover card on the page, in
 * the order the sources are first cited (`references-panel-items.ts`).
 *
 * - Each entry is two lines (`reference-card-header.tsx`): the card's summary,
 *   then `Authors ’yy — qualifications` and the bibliography line in the
 *   reader's citation style; the quoted card text, with its underlining and
 *   highlights, is what opens. Small flags on the card's top edge say what
 *   kind of source it is and whether the author is a professor or an institution.
 * - Clicking an entry scrolls the page to where it is cited and flashes the
 *   citation; clicking again goes on to the next place it is cited, in page
 *   order. The numbered chips jump to one place directly.
 * - **Collapse all** / **Expand all** switches between just the citations and
 *   the quoted text (remembered per browser); each entry's chevron opens one.
 * - **Read all** reads every card in order, each after the paragraph that
 *   introduces it, with the hover cards' voice (`readCardsAloud` in
 *   `card-voice.ts`). The panel and the page follow the card being read.
 *
 * The list is rebuilt while the panel is open, so it follows reading mode's
 * pages as they load. Escape or the close button closes it. The page's panel
 * sits under reading mode's `z-[60]` overlay and reading mode's own above it;
 * hover cards (`z-[70]`) open over both.
 */
import { useCallback, useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { BookMarked, ChevronDown, ChevronsDownUp, ChevronsUpDown, Square, Volume2, X } from "lucide-react"
import { cn } from "../../lib/utils"
import { buttonVariants } from "../ui/button"
import { SYNERGY_SLAYER_CLASS } from "../../lib/mdx/remark-debate-highlight"
import { ReferenceCardLines, ReferenceEdgeIcons, describeReference } from "./reference-card-header"
import { readCardsAloud, stopCardVoice } from "./card-voice"
import {
  REFERENCES_PANEL_ATTRIBUTE,
  collectReferenceItems,
  readAllCards,
  type ReferenceItem,
} from "./references-panel-items"

/** The page content the panel lists (`SYNERGY_SLAYER_CLASS` in routes/docs-page.tsx). */
const CONTENT_SELECTOR = `.${SYNERGY_SLAYER_CLASS}`
/** Whether entries show their full cards: "full" or "citations". */
const VIEW_STORAGE_KEY = "debate-docs-references-panel-view"
/** Added to a citation for a moment when the panel jumps to it. */
const FLASH_CLASS = "citation-link-flash"
const FLASH_MS = 1800

function readStoredFull(): boolean {
  try {
    return localStorage.getItem(VIEW_STORAGE_KEY) !== "citations"
  } catch {
    return true
  }
}

function storeFull(full: boolean) {
  try {
    localStorage.setItem(VIEW_STORAGE_KEY, full ? "full" : "citations")
  } catch {
    // Blocked storage: the choice lasts until the page changes.
  }
}

/** Scrolls the page to a citation and flashes it. */
function showCitation(link: HTMLElement) {
  link.scrollIntoView({ behavior: "smooth", block: "center" })
  link.classList.remove(FLASH_CLASS)
  // Restart the animation when the same citation is shown twice in a row.
  void link.offsetWidth
  link.classList.add(FLASH_CLASS)
  window.setTimeout(() => link.classList.remove(FLASH_CLASS), FLASH_MS)
}

const toolButton = (active: boolean) =>
  cn(
    buttonVariants({ size: "sm", className: "gap-2 [&_svg]:size-3.5 [&_svg]:text-fd-muted-foreground" }),
    active && "bg-fd-accent text-fd-accent-foreground hover:bg-fd-accent/80",
  )

const panelButton =
  "inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs font-medium hover:bg-fd-accent [&_svg]:size-3.5"

export interface ReferencesPanelButtonProps {
  /** The content whose citations are listed; the page's Synergy Slayer content by default. */
  contentSelector?: string
}

/** The toolbar button and the side panel it opens (see the module doc). */
export function ReferencesPanelButton({ contentSelector = CONTENT_SELECTOR }: ReferencesPanelButtonProps) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        type="button"
        aria-pressed={open}
        aria-haspopup="dialog"
        title="Show every cited card in a side panel, in the order the page cites them"
        className={toolButton(open)}
        onClick={() => setOpen((on) => !on)}
      >
        <BookMarked />
        References
      </button>
      {open && <ReferencesPanel contentSelector={contentSelector} onClose={() => setOpen(false)} />}
    </>
  )
}

function ReferencesPanel({ contentSelector, onClose }: { contentSelector: string; onClose: () => void }) {
  const [items, setItems] = useState<ReferenceItem[]>([])
  const [full, setFull] = useState(true)
  /** Entries opened or closed one at a time, overriding `full`. */
  const [overrides, setOverrides] = useState<Record<string, boolean>>({})
  const [readingIndex, setReadingIndex] = useState<number | null>(null)
  const reader = useRef<AbortController | null>(null)
  const listRef = useRef<HTMLOListElement>(null)
  /** The place each entry jumps to next, by href. */
  const nextPlace = useRef(new Map<string, number>())

  useEffect(() => setFull(readStoredFull()), [])

  // Collect now, and again whenever the content changes while the panel is open.
  useEffect(() => {
    let frame = 0
    let observer: MutationObserver | null = null
    const collect = () => {
      frame = 0
      const root = document.querySelector(contentSelector)
      setItems(root ? collectReferenceItems(root) : [])
      if (root && !observer) {
        observer = new MutationObserver(() => {
          if (!frame) frame = requestAnimationFrame(collect)
        })
        observer.observe(root, { childList: true, subtree: true })
      }
    }
    collect()
    // Reading mode mounts its content after the button; look again shortly.
    const retry = window.setTimeout(() => {
      if (!observer) collect()
    }, 500)
    return () => {
      observer?.disconnect()
      if (frame) cancelAnimationFrame(frame)
      window.clearTimeout(retry)
    }
  }, [contentSelector])

  const stopReading = useCallback(() => {
    reader.current?.abort()
    reader.current = null
    setReadingIndex(null)
  }, [])

  // Closing the panel stops the reading.
  useEffect(() => () => reader.current?.abort(), [])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented) return
      // A hover card open over the panel closes first.
      if (document.querySelector(".citation-tooltip[data-state$=\"open\"]")) return
      event.preventDefault()
      event.stopPropagation()
      onClose()
    }
    // Capture, so reading mode's own Escape handler doesn't close the reader too.
    window.addEventListener("keydown", onKey, true)
    return () => window.removeEventListener("keydown", onKey, true)
  }, [onClose])

  const isOpen = (item: ReferenceItem) => overrides[item.href] ?? full

  const setAll = (next: boolean) => {
    setFull(next)
    setOverrides({})
    storeFull(next)
  }

  const jump = (item: ReferenceItem, place?: number) => {
    const live = item.links.filter((link) => link.isConnected)
    if (live.length === 0) return
    const index = (place ?? nextPlace.current.get(item.href) ?? 0) % live.length
    nextPlace.current.set(item.href, index + 1)
    showCitation(live[index]!)
  }

  const toggleReadAll = () => {
    if (reader.current) {
      stopReading()
      return
    }
    stopCardVoice()
    const ctrl = new AbortController()
    reader.current = ctrl
    const reading = items
    setReadingIndex(0)
    void readCardsAloud(readAllCards(reading), ctrl.signal, (index) => {
      if (ctrl.signal.aborted) return
      setReadingIndex(index)
      const item = reading[index]
      listRef.current?.querySelector(`[data-reference-index="${index}"]`)?.scrollIntoView({ behavior: "smooth", block: "nearest" })
      const link = item?.links.find((l) => l.isConnected)
      if (link) showCitation(link)
    }).finally(() => {
      if (reader.current === ctrl) {
        reader.current = null
        setReadingIndex(null)
      }
    })
  }

  const allOpen = items.length > 0 && items.every(isOpen)
  const reading = readingIndex !== null

  return createPortal(
    <aside
      {...{ [REFERENCES_PANEL_ATTRIBUTE]: "" }}
      role="dialog"
      aria-label="References cited on this page"
      className={cn(
        "fixed inset-y-0 right-0 flex w-full flex-col border-l bg-fd-background text-fd-foreground shadow-2xl sm:w-[min(21rem,100vw)]",
        // The page's panel stays under reading mode (z-[60]); reading mode's own sits above it.
        contentSelector === CONTENT_SELECTOR ? "z-[55]" : "z-[65]",
      )}
    >
      <header className="flex flex-col gap-2 border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <BookMarked className="size-4 shrink-0 text-fd-primary" aria-hidden />
          <h2 className="mr-auto text-sm font-semibold">
            References <span className="font-normal text-fd-muted-foreground">· {items.length}</span>
          </h2>
          <button
            type="button"
            aria-label="Close the References panel"
            title="Close (Esc)"
            className="rounded-md p-1 text-fd-muted-foreground hover:bg-fd-accent hover:text-fd-accent-foreground"
            onClick={onClose}
          >
            <X className="size-4" />
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className={panelButton}
            disabled={items.length === 0}
            title={allOpen ? "Show just the citations" : "Show every full card"}
            onClick={() => setAll(!allOpen)}
          >
            {allOpen ? <ChevronsDownUp aria-hidden /> : <ChevronsUpDown aria-hidden />}
            {allOpen ? "Collapse all" : "Expand all"}
          </button>
          <button
            type="button"
            aria-pressed={reading}
            className={cn(panelButton, reading && "bg-fd-accent text-fd-accent-foreground")}
            disabled={items.length === 0}
            title={reading ? "Stop reading" : "Read every card aloud, in order, each after the paragraph that introduces it"}
            onClick={toggleReadAll}
          >
            {reading ? <Square aria-hidden /> : <Volume2 aria-hidden />}
            {reading ? "Stop" : "Read all"}
          </button>
        </div>
      </header>

      {items.length === 0 ? (
        <p className="px-4 py-6 text-sm text-fd-muted-foreground">No citations with reference cards on this page.</p>
      ) : (
        <ol ref={listRef} className="flex-1 space-y-2 overflow-y-auto px-3 py-3">
          {items.map((item, index) => {
            const expanded = isOpen(item)
            const display = describeReference(item)
            const hasQuote = display.card.quoteHtml !== ""
            return (
              <li
                key={item.href || index}
                data-reference-index={index}
                className={cn(
                  "relative rounded-lg border bg-fd-card",
                  readingIndex === index && "border-fd-primary ring-1 ring-fd-primary",
                )}
              >
                <ReferenceEdgeIcons display={display} />
                <div className="flex items-start gap-1 px-2 py-2">
                  <button
                    type="button"
                    className="min-w-0 flex-1 rounded-md px-1 py-0.5 text-left text-xs leading-relaxed hover:bg-fd-accent/60"
                    title={
                      item.links.length > 1
                        ? `Show where it is cited (${item.links.length} places; click again for the next)`
                        : "Show where it is cited"
                    }
                    onClick={() => jump(item)}
                  >
                    <span className="mr-1.5 inline-block min-w-6 rounded-full bg-fd-muted px-1.5 text-center font-medium text-fd-muted-foreground">
                      {item.number}
                    </span>
                    <ReferenceCardLines item={item} display={display} />
                  </button>
                  <button
                    type="button"
                    aria-expanded={expanded}
                    aria-label={expanded ? "Hide the quoted text" : "Show the quoted text"}
                    className="rounded-md p-1 text-fd-muted-foreground hover:bg-fd-accent hover:text-fd-accent-foreground"
                    onClick={() => setOverrides((all) => ({ ...all, [item.href]: !expanded }))}
                  >
                    <ChevronDown className={cn("size-4 transition-transform", expanded && "rotate-180")} />
                  </button>
                </div>
                {item.links.length > 1 && (
                  <div className="flex flex-wrap items-center gap-1 px-3 pb-2 text-[0.7rem] text-fd-muted-foreground">
                    Cited at
                    {item.links.map((_, place) => (
                      <button
                        key={place}
                        type="button"
                        className="min-w-5 rounded border px-1 hover:bg-fd-accent hover:text-fd-accent-foreground"
                        title={`Show citation ${place + 1} of ${item.links.length}`}
                        onClick={() => jump(item, place)}
                      >
                        {place + 1}
                      </button>
                    ))}
                  </div>
                )}
                {expanded && (
                  <div className={`prose prose-sm ${SYNERGY_SLAYER_CLASS} citation-card border-t px-3 py-2`}>
                    {hasQuote ? (
                      <div dangerouslySetInnerHTML={{ __html: display.card.quoteHtml }} />
                    ) : (
                      <p className="citation-card-empty">No quoted text for this source yet.</p>
                    )}
                  </div>
                )}
              </li>
            )
          })}
        </ol>
      )}
    </aside>,
    document.body,
  )
}
