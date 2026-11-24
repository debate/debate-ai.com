"use client"
/**
 * @file highlight-toggle.tsx
 * @description The marking tools on the Synergy Slayer pages' toolbar and in
 * their reading mode (`reading-mode.tsx`):
 *
 * - **Marks** (`MarksMenu`): a dropdown that shows or hides highlighting and
 *   underlining separately, has an AI cut the text ("AI highlight &
 *   underline"), and clears the reader's own marks. "Highlighting" is the
 *   background of the `==text==` marks authored into the MDX
 *   (`lib/mdx/remark-debate-highlight.ts`) and of the reader's highlights;
 *   "Underlining" is their underline. The quoted excerpts in the References
 *   cards and the citation hover tooltips keep both either way.
 * - **Auto highlight** / **Auto underline** (`AutoMarkButton`): while on,
 *   every text selection on the page (or in reading mode) is toggled at once,
 *   with no hotkey: unmarked text gets marked, and selecting text that is
 *   already marked takes the mark off that part (authored marks included).
 *   Both can be on together. The marking is `toggleMarks` from
 *   `@debate-ai/reading-mode/marks`.
 *
 * Show/hide choices are stored per browser, so they carry across every
 * Synergy Slayer page, and applied as `data-debate-highlights` /
 * `data-debate-underlines` on `<html>`; `styles/docs.css` keys the styling
 * off them, inside `.synergy-slayer-doc` only. Both are on unless the reader
 * turned them off. `HIGHLIGHT_INIT_SCRIPT` applies a stored "off" before
 * first paint, so it never flashes on. The auto modes last for the visit and
 * set `data-debate-auto-highlight` / `data-debate-auto-underline` (the
 * selection is tinted while one is on). The page's and reading mode's copies
 * of every control stay in step through `CHANGE_EVENT`. The reader's own
 * marks are not saved: they last until the page changes.
 */
import { useEffect, useRef, useState } from "react"
import { Check, ChevronDown, Eraser, Highlighter, Loader2, Sparkles, Underline } from "lucide-react"
import {
  AUTO_CUT_SYSTEM_PROMPT,
  autoCutPrompt,
  chunkPassages,
  clearMarks,
  markPhrase,
  parseAutoCut,
  toggleMarks,
  type MarkKind,
} from "@debate-ai/reading-mode/marks"
import { cn } from "../../lib/utils"
import { buttonVariants } from "../ui/button"
import { generateWithSite, readableText } from "./docs-ai"

/** The element marking works inside (`SYNERGY_SLAYER_CLASS` in routes/docs-page.tsx; reading mode's text too). */
const CONTENT_SELECTOR = ".synergy-slayer-doc"
/** Fired on `window` when a setting or the marks change, so every copy of the controls agrees. */
export const CHANGE_EVENT = "debate-docs-highlights-change"

type Setting = "highlights" | "underlines" | "auto-highlight" | "auto-underline"

/** Where each show/hide choice is kept, in this browser. The auto modes aren't kept. */
const STORAGE_KEYS: Partial<Record<Setting, string>> = {
  highlights: "debate-docs-highlights",
  underlines: "debate-docs-underlines",
}
const attributeOf = (setting: Setting) => `data-debate-${setting}`
const DEFAULT_ON: Record<Setting, boolean> = {
  highlights: true,
  underlines: true,
  "auto-highlight": false,
  "auto-underline": false,
}
const AUTO_SETTING: Record<MarkKind, Setting> = { highlight: "auto-highlight", underline: "auto-underline" }
const SHOW_SETTING: Record<MarkKind, Setting> = { highlight: "highlights", underline: "underlines" }

/** Inline script for the docs layout: restores a stored "off" before paint. */
export const HIGHLIGHT_INIT_SCRIPT = `try{${(["highlights", "underlines"] as const)
  .map(
    (setting) =>
      `if(localStorage.getItem(${JSON.stringify(STORAGE_KEYS[setting])})==="off")document.documentElement.setAttribute(${JSON.stringify(attributeOf(setting))},"off");`,
  )
  .join("")}}catch(e){}`

function readSetting(setting: Setting): boolean {
  const attribute = document.documentElement.getAttribute(attributeOf(setting))
  if (attribute) return attribute === "on"
  const key = STORAGE_KEYS[setting]
  if (!key) return DEFAULT_ON[setting]
  try {
    const stored = localStorage.getItem(key)
    return stored ? stored !== "off" : DEFAULT_ON[setting]
  } catch {
    return DEFAULT_ON[setting]
  }
}

function writeSetting(setting: Setting, on: boolean) {
  document.documentElement.setAttribute(attributeOf(setting), on ? "on" : "off")
  const key = STORAGE_KEYS[setting]
  if (key) {
    try {
      localStorage.setItem(key, on ? "on" : "off")
    } catch {
      // Private mode or blocked storage: the choice lasts for this page only.
    }
  }
  window.dispatchEvent(new Event(CHANGE_EVENT))
}

/** One setting, kept in step with every other copy of the controls. */
function useSetting(setting: Setting): [boolean, (on: boolean) => void] {
  const [on, setOn] = useState(DEFAULT_ON[setting])
  useEffect(() => {
    const value = readSetting(setting)
    setOn(value)
    // Hydrating <html> can drop the attribute HIGHLIGHT_INIT_SCRIPT set, which
    // left the menu saying "off" over a page still showing highlights.
    document.documentElement.setAttribute(attributeOf(setting), value ? "on" : "off")
    const onChange = () => setOn(readSetting(setting))
    window.addEventListener(CHANGE_EVENT, onChange)
    return () => window.removeEventListener(CHANGE_EVENT, onChange)
  }, [setting])
  return [on, (next) => writeSetting(setting, next)]
}

/** Toggles the finished selection when an auto mode is on. */
function onSelectionEnd() {
  const kinds = (["highlight", "underline"] as const).filter((kind) => readSetting(AUTO_SETTING[kind]))
  if (kinds.length === 0) return
  const selection = window.getSelection()
  if (!selection || selection.rangeCount === 0 || selection.isCollapsed) return
  const range = selection.getRangeAt(0)
  const container = range.commonAncestorContainer
  const element = container.nodeType === Node.ELEMENT_NODE ? (container as Element) : container.parentElement
  const root = element?.closest<HTMLElement>(CONTENT_SELECTOR)
  if (!element || !root) return
  // Leave form fields, buttons and the hover cards alone.
  if (element.closest("input, textarea, select, button, [contenteditable], .citation-card")) return
  const results = toggleMarks(range, root, kinds)
  if (results.some(Boolean)) {
    selection.removeAllRanges()
    window.dispatchEvent(new Event(CHANGE_EVENT))
  }
}

/** The selection listener is shared by every AutoMarkButton: installed once, removed with the last. */
let listeners = 0
const deferredSelectionEnd = () => setTimeout(onSelectionEnd, 0)
const onKeyUp = (event: KeyboardEvent) => {
  if (event.key === "Shift" || (event.shiftKey && event.key.startsWith("Arrow"))) deferredSelectionEnd()
}
function useAutoMarkListener() {
  useEffect(() => {
    if (listeners++ === 0) {
      document.addEventListener("mouseup", deferredSelectionEnd)
      document.addEventListener("touchend", deferredSelectionEnd)
      document.addEventListener("keyup", onKeyUp)
    }
    return () => {
      if (--listeners === 0) {
        document.removeEventListener("mouseup", deferredSelectionEnd)
        document.removeEventListener("touchend", deferredSelectionEnd)
        document.removeEventListener("keyup", onKeyUp)
      }
    }
  }, [])
}

const toolButton = (active: boolean) =>
  cn(
    buttonVariants({ size: "sm", className: "gap-2 [&_svg]:size-3.5 [&_svg]:text-fd-muted-foreground" }),
    active && "bg-fd-accent text-fd-accent-foreground hover:bg-fd-accent/80",
  )

/** "Auto highlight" or "Auto underline": while on, each selection is toggled at once. */
export function AutoMarkButton({ kind }: { kind: MarkKind }) {
  useAutoMarkListener()
  const [on, setOn] = useSetting(AUTO_SETTING[kind])
  const [, setShown] = useSetting(SHOW_SETTING[kind])
  const noun = kind === "highlight" ? "highlight" : "underline"
  const Icon = kind === "highlight" ? Highlighter : Underline
  return (
    <button
      type="button"
      aria-pressed={on}
      title={
        on
          ? `Stop auto-${noun}ing`
          : `Auto-${noun}er: select text to ${noun} it, select ${noun}d text to take it off. No hotkey needed.`
      }
      className={toolButton(on)}
      onClick={() => {
        // Marks you can't see would be no use: turning a mode on shows its kind.
        if (!on) setShown(true)
        setOn(!on)
      }}
    >
      <Icon />
      <span>Auto {noun}</span>
    </button>
  )
}

/** The AI's cut of `root`, chunk by chunk; reports progress as [done, total]. */
async function aiCut(root: HTMLElement, signal: AbortSignal, progress: (done: number, total: number) => void) {
  const chunks = chunkPassages(readableText(root))
  let marked = 0
  progress(0, chunks.length)
  for (let i = 0; i < chunks.length; i++) {
    if (signal.aborted) return marked
    const answer = await generateWithSite({
      system: AUTO_CUT_SYSTEM_PROMPT,
      prompt: autoCutPrompt(chunks[i]),
      maxTokens: 2000,
      signal,
    })
    const cut = parseAutoCut(answer)
    // Underline first: the highlighting sits inside it.
    for (const phrase of cut.underline) if (markPhrase(root, phrase, "underline")) marked++
    for (const phrase of cut.highlight) if (markPhrase(root, phrase, "highlight")) marked++
    window.dispatchEvent(new Event(CHANGE_EVENT))
    progress(i + 1, chunks.length)
  }
  return marked
}

/** The page's own text, not reading mode's copy of it. */
const PAGE_CONTENT_SELECTOR = `${CONTENT_SELECTOR}:not([data-reading-mode-content])`

/**
 * The Marks dropdown: show or hide highlighting and underlining, have the AI
 * cut the text, clear the reader's marks. `contentSelector` finds the text
 * the AI and Clear act on (looked up on use, so it can be content loaded
 * later): the page's by default, reading mode passes its own.
 */
export function MarksMenu({
  contentSelector = PAGE_CONTENT_SELECTOR,
  align = "start",
}: {
  contentSelector?: string
  align?: "start" | "end"
}) {
  const getRoot = () => document.querySelector<HTMLElement>(contentSelector)
  const [open, setOpen] = useState(false)
  const [highlights, setHighlights] = useSetting("highlights")
  const [underlines, setUnderlines] = useSetting("underlines")
  const [status, setStatus] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const wrapperRef = useRef<HTMLDivElement | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => () => abortRef.current?.abort(), [])

  useEffect(() => {
    if (!open) return
    const onPointer = (event: PointerEvent) => {
      if (!wrapperRef.current?.contains(event.target as Node)) setOpen(false)
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        // Leave reading mode open: this Escape was for the menu.
        event.preventDefault()
        setOpen(false)
      }
    }
    document.addEventListener("pointerdown", onPointer)
    document.addEventListener("keydown", onKey, true)
    return () => {
      document.removeEventListener("pointerdown", onPointer)
      document.removeEventListener("keydown", onKey, true)
    }
  }, [open])

  useEffect(() => {
    if (!status || busy) return
    const timer = setTimeout(() => setStatus(null), 4000)
    return () => clearTimeout(timer)
  }, [status, busy])

  const runAi = async () => {
    setOpen(false)
    const root = getRoot()
    if (!root) return setStatus("Nothing to mark yet")
    setHighlights(true)
    setUnderlines(true)
    const controller = new AbortController()
    abortRef.current = controller
    setBusy(true)
    try {
      const marked = await aiCut(root, controller.signal, (done, total) =>
        setStatus(total > 1 ? `AI marking ${done}/${total}` : "AI marking…"),
      )
      setStatus(marked > 0 ? "AI marks added" : "The AI found nothing to mark")
    } catch (error) {
      if (controller.signal.aborted) return
      console.warn("[docs marks] AI marking failed", error)
      setStatus(error instanceof Error && error.name === "SignInRequiredError" ? "Sign in to use AI marks" : "AI marking failed")
    } finally {
      setBusy(false)
    }
  }

  const clear = () => {
    setOpen(false)
    const root = getRoot()
    if (root) clearMarks(root)
    window.dispatchEvent(new Event(CHANGE_EVENT))
  }

  const toggles: { label: string; on: boolean; set: (on: boolean) => void; icon: typeof Highlighter }[] = [
    { label: "Highlighting", on: highlights, set: setHighlights, icon: Highlighter },
    { label: "Underlining", on: underlines, set: setUnderlines, icon: Underline },
  ]
  const itemClass =
    "flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left hover:bg-fd-accent hover:text-fd-accent-foreground disabled:opacity-50"

  return (
    <div ref={wrapperRef} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        title="Show or hide highlighting and underlining, or have the AI mark the text"
        className={toolButton(false)}
        onClick={() => setOpen((value) => !value)}
      >
        {busy ? <Loader2 className="animate-spin" /> : status ? <Check /> : <Underline />}
        <span>{status ?? "Marks"}</span>
        <ChevronDown />
      </button>
      {open && (
        <div
          role="menu"
          className={cn(
            "absolute top-full z-50 mt-1 min-w-56 rounded-md border bg-fd-popover p-1 text-sm text-fd-popover-foreground shadow-md",
            align === "end" ? "right-0" : "left-0",
          )}
        >
          {toggles.map(({ label, on, set, icon: Icon }) => (
            <button key={label} type="button" role="menuitemcheckbox" aria-checked={on} className={itemClass} onClick={() => set(!on)}>
              <Icon className="size-4 text-fd-muted-foreground" />
              <span className="flex-1">{label}</span>
              <span className="text-xs text-fd-muted-foreground">{on ? "On" : "Off"}</span>
              {on && <Check className="size-4" />}
            </button>
          ))}
          <div role="separator" className="my-1 border-t" />
          <button type="button" role="menuitem" disabled={busy} className={itemClass} onClick={runAi}>
            <Sparkles className="size-4 text-fd-muted-foreground" />
            AI highlight &amp; underline
          </button>
          <button type="button" role="menuitem" className={itemClass} onClick={clear}>
            <Eraser className="size-4 text-fd-muted-foreground" />
            Clear my marks
          </button>
        </div>
      )}
    </div>
  )
}
