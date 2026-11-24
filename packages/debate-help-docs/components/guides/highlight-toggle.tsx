"use client"
/**
 * @file highlight-toggle.tsx
 * @description The Marks dropdown (`MarksMenu`) on the Synergy Slayer pages'
 * toolbar and in their reading mode (`reading-mode.tsx`). Every marking tool
 * lives in it, in three groups:
 *
 * - **Show**: switches Underlining, Highlighting and, under it, Short
 *   highlighting on or off separately. "Highlighting" is the (long)
 *   background of the `==text==` marks authored into the MDX
 *   (`lib/mdx/remark-debate-highlight.ts`) and of the reader's highlights;
 *   "Underlining" is their underline; "Short highlighting" is the reader's
 *   secondary, minimal highlight (a low marker stroke). The quoted excerpts in
 *   the References cards and the citation hover tooltips keep theirs either way.
 * - **Auto underline / Auto highlight / Auto short highlight**: while one is
 *   on, every text selection on the page (or in reading mode) is toggled at
 *   once, with no hotkey: unmarked text gets marked, and selecting text that is
 *   already marked takes the mark off that part (authored marks included, so
 *   your own highlighting overrides the page's). Highlighting is long by
 *   default; long and short auto highlighting are either-or, and either can
 *   run with auto underline. The marking is `toggleMarks` from
 *   `@debate-ai/reading-mode/marks`. The reader's marks take a colour of
 *   their own (`styles/docs.css`), never the page's highlight colour.
 * - **AI highlight & underline**, and **Reset to default highlighting**,
 *   which drops every mark the reader made and restores the page's own.
 *
 * Show/hide choices are stored per browser, so they carry across every
 * Synergy Slayer page, and applied as `data-debate-highlights` /
 * `data-debate-underlines` / `data-debate-short-highlights` on `<html>`;
 * `styles/docs.css` keys the styling off them, inside `.synergy-slayer-doc`
 * only. All are on unless the reader turned them off. `HIGHLIGHT_INIT_SCRIPT`
 * applies a stored "off" before first paint, so it never flashes on. The auto
 * modes last for the visit and set `data-debate-auto-<kind>` (the selection is
 * tinted while one is on). The page's and reading mode's copies of the menu
 * stay in step through `CHANGE_EVENT`. The reader's own marks are not saved:
 * they last until the page changes.
 */
import { useEffect, useRef, useState } from "react"
import { Check, ChevronDown, Highlighter, Loader2, RotateCcw, Sparkles, Underline, type LucideIcon } from "lucide-react"
import {
  AUTO_CUT_SYSTEM_PROMPT,
  autoCutPrompt,
  chunkPassages,
  clearMarks,
  MARK_KINDS,
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

type ShowSetting = "highlights" | "underlines" | "short-highlights"
type Setting = ShowSetting | `auto-${MarkKind}`

const SHOW_SETTING: Record<MarkKind, ShowSetting> = {
  highlight: "highlights",
  underline: "underlines",
  "short-highlight": "short-highlights",
}
const AUTO_SETTING = (kind: MarkKind): Setting => `auto-${kind}`
const SHOW_SETTINGS = Object.values(SHOW_SETTING)

/** Where each show/hide choice is kept, in this browser. The auto modes aren't kept. */
const storageKeyOf = (setting: Setting) =>
  (SHOW_SETTINGS as string[]).includes(setting) ? `debate-docs-${setting}` : null
const attributeOf = (setting: Setting) => `data-debate-${setting}`
/** The show switches start on, the auto modes off. */
const defaultOn = (setting: Setting) => !setting.startsWith("auto-")

/** How each kind reads in the menu, in its order: underlining, then long and short highlighting. */
const KIND_LABEL: Record<MarkKind, { show: string; auto: string; icon: LucideIcon; nested?: boolean }> = {
  underline: { show: "Underlining", auto: "Auto underline", icon: Underline },
  highlight: { show: "Highlighting", auto: "Auto highlight", icon: Highlighter },
  "short-highlight": { show: "Short highlighting", auto: "Auto short highlight", icon: Highlighter, nested: true },
}
/** Long and short auto highlighting are either-or: turning one on turns the other off. */
const EXCLUSIVE: Partial<Record<MarkKind, MarkKind>> = { highlight: "short-highlight", "short-highlight": "highlight" }

/** Inline script for the docs layout: restores a stored "off" before paint. */
export const HIGHLIGHT_INIT_SCRIPT = `try{${SHOW_SETTINGS.map(
  (setting) =>
    `if(localStorage.getItem(${JSON.stringify(storageKeyOf(setting))})==="off")document.documentElement.setAttribute(${JSON.stringify(attributeOf(setting))},"off");`,
).join("")}}catch(e){}`

function readSetting(setting: Setting): boolean {
  const attribute = document.documentElement.getAttribute(attributeOf(setting))
  if (attribute) return attribute === "on"
  const key = storageKeyOf(setting)
  if (!key) return defaultOn(setting)
  try {
    const stored = localStorage.getItem(key)
    return stored ? stored !== "off" : defaultOn(setting)
  } catch {
    return defaultOn(setting)
  }
}

function writeSetting(setting: Setting, on: boolean) {
  document.documentElement.setAttribute(attributeOf(setting), on ? "on" : "off")
  const key = storageKeyOf(setting)
  if (key) {
    try {
      localStorage.setItem(key, on ? "on" : "off")
    } catch {
      // Private mode or blocked storage: the choice lasts for this page only.
    }
  }
  window.dispatchEvent(new Event(CHANGE_EVENT))
}

/** Every setting, kept in step with every other copy of the controls. */
function useSettings(): Record<Setting, boolean> {
  const all: Setting[] = [...SHOW_SETTINGS, ...MARK_KINDS.map(AUTO_SETTING)]
  const read = () => Object.fromEntries(all.map((setting) => [setting, readSetting(setting)])) as Record<Setting, boolean>
  const [values, setValues] = useState(
    () => Object.fromEntries(all.map((setting) => [setting, defaultOn(setting)])) as Record<Setting, boolean>,
  )
  useEffect(() => {
    const current = read()
    setValues(current)
    // Hydrating <html> can drop the attribute HIGHLIGHT_INIT_SCRIPT set, which
    // left the menu saying "off" over a page still showing highlights.
    for (const setting of all) document.documentElement.setAttribute(attributeOf(setting), current[setting] ? "on" : "off")
    const onChange = () => setValues(read())
    window.addEventListener(CHANGE_EVENT, onChange)
    return () => window.removeEventListener(CHANGE_EVENT, onChange)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return values
}

/** Turns an auto mode on or off; on also shows its kind (marks you can't see are no use). */
function setAutoMode(kind: MarkKind, on: boolean) {
  if (on) {
    const other = EXCLUSIVE[kind]
    if (other && readSetting(AUTO_SETTING(other))) writeSetting(AUTO_SETTING(other), false)
    writeSetting(SHOW_SETTING[kind], true)
  }
  writeSetting(AUTO_SETTING(kind), on)
}

/** Toggles the finished selection when an auto mode is on. */
function onSelectionEnd() {
  // Underline first: a highlight then sits inside it, as on a cut card.
  const kinds = MARK_KINDS.filter((kind) => readSetting(AUTO_SETTING(kind)))
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

/** The selection listener is shared by every copy of the menu: installed once, removed with the last. */
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
 * The Marks dropdown: show or hide each kind of mark, turn the auto modes on,
 * have the AI cut the text, reset to the page's default highlighting.
 * `contentSelector` finds the text the AI and Reset act on (looked up on use,
 * so it can be content loaded later): the page's by default, reading mode
 * passes its own.
 */
export function MarksMenu({
  contentSelector = PAGE_CONTENT_SELECTOR,
  align = "start",
}: {
  contentSelector?: string
  align?: "start" | "end"
}) {
  useAutoMarkListener()
  const getRoot = () => document.querySelector<HTMLElement>(contentSelector)
  const [open, setOpen] = useState(false)
  const settings = useSettings()
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
    writeSetting("highlights", true)
    writeSetting("underlines", true)
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

  const reset = () => {
    setOpen(false)
    const root = getRoot()
    if (root) clearMarks(root)
    for (const setting of SHOW_SETTINGS) if (!settings[setting]) writeSetting(setting, true)
    window.dispatchEvent(new Event(CHANGE_EVENT))
    setStatus("Default highlighting")
  }

  // The button names the auto mode that is on, so it's clear why selecting marks text.
  const activeAuto = MARK_KINDS.filter((kind) => settings[AUTO_SETTING(kind)])
  const ButtonIcon = activeAuto.length ? KIND_LABEL[activeAuto[activeAuto.length - 1]].icon : Underline
  const buttonLabel =
    status ?? (activeAuto.length === 1 ? KIND_LABEL[activeAuto[0]].auto : activeAuto.length ? "Auto marking" : "Marks")

  const itemClass =
    "flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left hover:bg-fd-accent hover:text-fd-accent-foreground disabled:opacity-50"
  const groupLabel = "px-2 pb-0.5 pt-1.5 text-xs font-medium text-fd-muted-foreground"

  return (
    <div ref={wrapperRef} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        title="Marks: show or hide underlining and highlighting, auto-mark what you select, or have the AI mark the text"
        className={toolButton(activeAuto.length > 0)}
        onClick={() => setOpen((value) => !value)}
      >
        {busy ? <Loader2 className="animate-spin" /> : status ? <Check /> : <ButtonIcon />}
        <span>{buttonLabel}</span>
        <ChevronDown />
      </button>
      {open && (
        <div
          role="menu"
          aria-label="Marks"
          className={cn(
            "absolute top-full z-50 mt-1 min-w-64 rounded-md border bg-fd-popover p-1 text-sm text-fd-popover-foreground shadow-md",
            align === "end" ? "right-0" : "left-0",
          )}
        >
          <div className={groupLabel}>Show</div>
          {MARK_KINDS.map((kind) => {
            const { show, icon: Icon, nested } = KIND_LABEL[kind]
            const setting = SHOW_SETTING[kind]
            const on = settings[setting]
            return (
              <button
                key={setting}
                type="button"
                role="menuitemcheckbox"
                aria-checked={on}
                className={cn(itemClass, nested && "pl-7")}
                onClick={() => writeSetting(setting, !on)}
              >
                <Icon className={cn("text-fd-muted-foreground", nested ? "size-3.5" : "size-4")} />
                <span className="flex-1">{show}</span>
                <span className="text-xs text-fd-muted-foreground">{on ? "On" : "Off"}</span>
                {on && <Check className="size-4" />}
              </button>
            )
          })}
          <div role="separator" className="my-1 border-t" />
          <div className={groupLabel}>Select text to mark it, select marked text to unmark it</div>
          {MARK_KINDS.map((kind) => {
            const { auto, icon: Icon, nested } = KIND_LABEL[kind]
            const on = settings[AUTO_SETTING(kind)]
            return (
              <button
                key={kind}
                type="button"
                role="menuitemcheckbox"
                aria-checked={on}
                title={
                  kind === "highlight"
                    ? "Long highlighting, the default. Your highlights take their own colour, apart from the page's."
                    : kind === "short-highlight"
                      ? "A secondary, minimal highlight: the few words you'd read in a short version."
                      : undefined
                }
                className={cn(itemClass, nested && "pl-7")}
                onClick={() => setAutoMode(kind, !on)}
              >
                <Icon className={cn("text-fd-muted-foreground", nested ? "size-3.5" : "size-4")} />
                <span className="flex-1">{auto}</span>
                {kind === "highlight" && <span className="text-xs text-fd-muted-foreground">Long</span>}
                {on && <Check className="size-4" />}
              </button>
            )
          })}
          <div role="separator" className="my-1 border-t" />
          <button type="button" role="menuitem" disabled={busy} className={itemClass} onClick={runAi}>
            <Sparkles className="size-4 text-fd-muted-foreground" />
            AI highlight &amp; underline
          </button>
          <button type="button" role="menuitem" className={itemClass} onClick={reset}>
            <RotateCcw className="size-4 text-fd-muted-foreground" />
            Reset to default highlighting
          </button>
        </div>
      )}
    </div>
  )
}
