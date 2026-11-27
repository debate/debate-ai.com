"use client"
/**
 * @file highlight-toggle.tsx
 * @description The Marks dropdown (`MarksMenu`) on the Synergy Slayer pages'
 * toolbar and in their reading mode (`reading-mode.tsx`). Every marking tool
 * lives in it, in three groups:
 *
 * - **Show**: switches Underlining, Highlighting and, under it, Short
 *   highlighting and Emphasizing words on or off separately. "Highlighting" is the (long)
 *   background of the `==text==` marks authored into the MDX
 *   (`lib/mdx/remark-debate-highlight.ts`) and of the reader's highlights;
 *   "Underlining" is their underline; "Short highlighting" is the reader's
 *   secondary, minimal highlight (a low marker stroke); "Emphasizing words"
 *   boxes the reader's chosen words, bolds, tints and underlines them. The quoted excerpts in
 *   the References cards and the citation hover tooltips keep theirs either way.
 * - **Auto underline / highlight / short highlight / emphasize**: while one is
 *   on, every text selection on the page (or in reading mode) is toggled at
 *   once, with no hotkey: unmarked text gets marked, and selecting text that is
 *   already marked takes the mark off that part (authored marks included, so
 *   your own highlighting overrides the page's). Highlighting is long by
 *   default; long and short auto highlighting are either-or, and either can
 *   run with auto underline and auto emphasize. The marking is `toggleMarks`
 *   from `@debate-ai/reading-mode/marks`. The reader's long highlights look
 *   exactly like the page's (`styles/docs.css`).
 * - **Undo mark** / **Redo mark**: every change to the marks (added, removed,
 *   AI, reset, removed all) is kept, the last 50 of them (`mark-history.ts`);
 *   Cmd/Ctrl+Z undoes and Cmd/Ctrl+Shift+Z or Ctrl+Y redoes, except in text fields.
 * - **AI highlight & underline**, **Reset to default highlighting**,
 *   which drops every mark the reader made and restores the page's own, and
 *   **Remove all marks**, which clears every mark and highlight of every kind
 *   (the page's own included; Reset brings those back).
 *
 * Show/hide choices are stored per browser, so they carry across every
 * Synergy Slayer page, and applied as `data-debate-highlights` /
 * `data-debate-underlines` / `data-debate-short-highlights` / `data-debate-emphasis` on `<html>`;
 * `styles/docs.css` keys the styling off them, inside `.synergy-slayer-doc`
 * only. All are on unless the reader turned them off. `HIGHLIGHT_INIT_SCRIPT`
 * applies a stored "off" before first paint, so it never flashes on. The auto
 * modes last for the visit and set `data-debate-auto-<kind>` (the selection is
 * tinted, and the pointer over the content is an animated pen or pencil
 * cursor from `styles/cursors/`, while one is on; the pen arrives with a swoosh,
 * `auto-highlight-swoosh.ts`). The page's and reading
 * mode's copies of the menu stay in step through `CHANGE_EVENT`. The reader's
 * own marks are not saved: they last until the page changes.
 */
import { useEffect, useRef, useState } from "react"
import { Bold, Check, ChevronDown, Highlighter, Eraser, Loader2, Redo2, RotateCcw, Sparkles, Underline, Undo2, type LucideIcon } from "lucide-react"
import {
  AUTO_CUT_SYSTEM_PROMPT,
  autoCutPrompt,
  chunkPassages,
  clearMarks,
  MARK_KINDS,
  markPhrase,
  parseAutoCut,
  removeAllMarks,
  toggleMarks,
  type MarkKind,
} from "@debate-ai/reading-mode/marks"
import { cn } from "../../lib/utils"
import { playAutoHighlightSwoosh } from "./auto-highlight-swoosh"
import { buttonVariants } from "../ui/button"
import { generateWithSite, readableText } from "./docs-ai"
import {
  HISTORY_EVENT,
  canRedoMark,
  canUndoMark,
  handleMarkHistoryKey,
  recordMarkChange,
  redoMark,
  undoMark,
} from "./mark-history"

/** The element marking works inside (`SYNERGY_SLAYER_CLASS` in routes/docs-page.tsx; reading mode's text too). */
const CONTENT_SELECTOR = ".synergy-slayer-doc"
/** Fired on `window` when a setting or the marks change, so every copy of the controls agrees. */
export const CHANGE_EVENT = "debate-docs-highlights-change"

type ShowSetting = "highlights" | "underlines" | "short-highlights" | "emphasis"
type Setting = ShowSetting | `auto-${MarkKind}`

const SHOW_SETTING: Record<MarkKind, ShowSetting> = {
  highlight: "highlights",
  underline: "underlines",
  "short-highlight": "short-highlights",
  emphasis: "emphasis",
}
const AUTO_SETTING = (kind: MarkKind): Setting => `auto-${kind}`
const SHOW_SETTINGS = Object.values(SHOW_SETTING)

/** Where each show/hide choice is kept, in this browser. The auto modes aren't kept. */
const storageKeyOf = (setting: Setting) =>
  (SHOW_SETTINGS as string[]).includes(setting) ? `debate-docs-${setting}` : null
const attributeOf = (setting: Setting) => `data-debate-${setting}`
/** The show switches start on, the auto modes off. */
const defaultOn = (setting: Setting) => !setting.startsWith("auto-")

/** How each kind reads in the menu, in its order: underlining, long and short highlighting, emphasis. */
const KIND_LABEL: Record<MarkKind, { show: string; auto: string; icon: LucideIcon; nested?: boolean }> = {
  underline: { show: "Underlining", auto: "Auto underline", icon: Underline },
  highlight: { show: "Highlighting", auto: "Auto highlight", icon: Highlighter },
  "short-highlight": { show: "Short highlighting", auto: "Auto short highlight", icon: Highlighter, nested: true },
  emphasis: { show: "Emphasizing words", auto: "Auto emphasize words", icon: Bold, nested: true },
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

/** Whether there is a mark change to undo or redo, kept up to date. */
function useMarkHistoryState() {
  const read = () => ({ canUndo: canUndoMark(), canRedo: canRedoMark() })
  const [state, setState] = useState({ canUndo: false, canRedo: false })
  useEffect(() => {
    const onChange = () => setState(read())
    onChange()
    window.addEventListener(HISTORY_EVENT, onChange)
    return () => window.removeEventListener(HISTORY_EVENT, onChange)
  }, [])
  return state
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
  const hadPen = autoCursorFor((k) => readSetting(AUTO_SETTING(k))) === "pen"
  if (on) {
    const other = EXCLUSIVE[kind]
    if (other && readSetting(AUTO_SETTING(other))) writeSetting(AUTO_SETTING(other), false)
    writeSetting(SHOW_SETTING[kind], true)
  }
  writeSetting(AUTO_SETTING(kind), on)
  // The swoosh goes with the pen appearing, not with every toggle: switching
  // between long and short highlighting keeps the pen, and so stays quiet.
  if (on && !hadPen && autoCursorFor((k) => readSetting(AUTO_SETTING(k))) === "pen") playAutoHighlightSwoosh()
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
  const results = recordMarkChange(root, () => toggleMarks(range, root, kinds))
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
/** Cmd/Ctrl+Z undoes the latest mark change, Cmd/Ctrl+Shift+Z or Ctrl+Y redoes it (`mark-history.ts`). */
const onHistoryKey = (event: KeyboardEvent) => {
  if (handleMarkHistoryKey(event)) window.dispatchEvent(new Event(CHANGE_EVENT))
}
function useAutoMarkListener() {
  useEffect(() => {
    if (listeners++ === 0) {
      document.addEventListener("mouseup", deferredSelectionEnd)
      document.addEventListener("touchend", deferredSelectionEnd)
      document.addEventListener("keyup", onKeyUp)
      document.addEventListener("keydown", onHistoryKey)
    }
    return () => {
      if (--listeners === 0) {
        document.removeEventListener("mouseup", deferredSelectionEnd)
        document.removeEventListener("touchend", deferredSelectionEnd)
        document.removeEventListener("keyup", onKeyUp)
        document.removeEventListener("keydown", onHistoryKey)
      }
    }
  }, [])
}

/**
 * The animated cursors of the auto modes (frames in `styles/docs.css`): a pen
 * for auto highlight and auto short highlight, a pencil for auto underline,
 * which wins when both are on. Each lists how long its frames last, in
 * jiffies (1/60s), as the .ani files give them.
 */
export const AUTO_CURSORS = {
  pen: [4, 4, 4, 4],
  pencil: [3, 3, 3, 3, 3, 3, 3, 3, 3, 6, 6, 6],
} as const
export type AutoCursor = keyof typeof AUTO_CURSORS
export const JIFFY_MS = 1000 / 60
export const AUTO_CURSOR_ATTRIBUTE = "data-debate-auto-cursor"
export const AUTO_CURSOR_FRAME_ATTRIBUTE = "data-debate-auto-frame"

/** The cursor for the auto modes that are on, or null for none (auto emphasize has its own selection tint only). */
export function autoCursorFor(on: (kind: MarkKind) => boolean): AutoCursor | null {
  if (on("underline")) return "pencil"
  return on("highlight") || on("short-highlight") ? "pen" : null
}

/** Every copy of the menu shares one cursor timer, started by the first and stopped with the last. */
let menus = 0
let shownCursor: AutoCursor | null = null
let cursorTimer: ReturnType<typeof setTimeout> | undefined
function syncAutoCursor() {
  const html = document.documentElement
  const cursor = menus > 0 ? autoCursorFor((kind) => readSetting(AUTO_SETTING(kind))) : null
  if (cursor === shownCursor) return
  clearTimeout(cursorTimer)
  shownCursor = cursor
  if (!cursor) {
    html.removeAttribute(AUTO_CURSOR_ATTRIBUTE)
    html.removeAttribute(AUTO_CURSOR_FRAME_ATTRIBUTE)
    return
  }
  html.setAttribute(AUTO_CURSOR_ATTRIBUTE, cursor)
  html.setAttribute(AUTO_CURSOR_FRAME_ATTRIBUTE, "0")
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return
  const rates = AUTO_CURSORS[cursor]
  let frame = 0
  const next = () => {
    cursorTimer = setTimeout(() => {
      frame = (frame + 1) % rates.length
      html.setAttribute(AUTO_CURSOR_FRAME_ATTRIBUTE, String(frame))
      next()
    }, rates[frame] * JIFFY_MS)
  }
  next()
}
function useAutoCursor(activeKinds: string) {
  useEffect(() => {
    menus++
    return () => {
      menus--
      syncAutoCursor()
    }
  }, [])
  useEffect(syncAutoCursor, [activeKinds])
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
  const group = `ai-${Date.now()}`
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
    // One undo takes back the whole AI cut, chunk after chunk.
    recordMarkChange(
      root,
      () => {
        for (const phrase of cut.underline) if (markPhrase(root, phrase, "underline")) marked++
        for (const phrase of cut.highlight) if (markPhrase(root, phrase, "highlight")) marked++
      },
      group,
    )
    window.dispatchEvent(new Event(CHANGE_EVENT))
    progress(i + 1, chunks.length)
  }
  return marked
}

/** The page's own text, not reading mode's copy of it. */
const PAGE_CONTENT_SELECTOR = `${CONTENT_SELECTOR}:not([data-reading-mode-content])`

/**
 * The Marks dropdown: show or hide each kind of mark, turn the auto modes on,
 * have the AI cut the text, reset to the page's default highlighting, or remove every mark.
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
  const history = useMarkHistoryState()
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
    if (root) recordMarkChange(root, () => clearMarks(root))
    for (const setting of SHOW_SETTINGS) if (!settings[setting]) writeSetting(setting, true)
    window.dispatchEvent(new Event(CHANGE_EVENT))
    setStatus("Default highlighting")
  }

  const undo = () => {
    setOpen(false)
    setStatus(undoMark() ? "Mark undone" : "Nothing to undo")
    window.dispatchEvent(new Event(CHANGE_EVENT))
  }

  const redo = () => {
    setOpen(false)
    setStatus(redoMark() ? "Mark redone" : "Nothing to redo")
    window.dispatchEvent(new Event(CHANGE_EVENT))
  }

  const removeAll = () => {
    setOpen(false)
    const root = getRoot()
    if (root) recordMarkChange(root, () => removeAllMarks(root))
    window.dispatchEvent(new Event(CHANGE_EVENT))
    setStatus("All marks removed")
  }

  // The button names the auto mode that is on, so it's clear why selecting marks text.
  const activeAuto = MARK_KINDS.filter((kind) => settings[AUTO_SETTING(kind)])
  useAutoCursor(activeAuto.join())
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
                    ? "Long highlighting, the default, in the same colour and style as the page's highlighting."
                    : kind === "short-highlight"
                      ? "A secondary, minimal highlight: the few words you'd read in a short version."
                      : kind === "emphasis"
                        ? "Emphasize words: boxes the phrase, bolds it, tints it and underlines it."
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
          <button
            type="button"
            role="menuitem"
            disabled={!history.canUndo}
            title="Take back the latest mark you added or removed (the last 50 changes are kept)"
            className={itemClass}
            onClick={undo}
          >
            <Undo2 className="size-4 text-fd-muted-foreground" />
            <span className="flex-1">Undo mark</span>
            <kbd className="text-xs text-fd-muted-foreground">Ctrl/⌘ Z</kbd>
          </button>
          <button
            type="button"
            role="menuitem"
            disabled={!history.canRedo}
            title="Put back the mark change you just undid"
            className={itemClass}
            onClick={redo}
          >
            <Redo2 className="size-4 text-fd-muted-foreground" />
            <span className="flex-1">Redo mark</span>
            <kbd className="text-xs text-fd-muted-foreground">Ctrl/⌘ Shift Z</kbd>
          </button>
          <div role="separator" className="my-1 border-t" />
          <button type="button" role="menuitem" disabled={busy} className={itemClass} onClick={runAi}>
            <Sparkles className="size-4 text-fd-muted-foreground" />
            AI highlight &amp; underline
          </button>
          <button type="button" role="menuitem" className={itemClass} onClick={reset}>
            <RotateCcw className="size-4 text-fd-muted-foreground" />
            Reset to default highlighting
          </button>
          <button type="button" role="menuitem" className={itemClass} onClick={removeAll}>
            <Eraser className="size-4 text-fd-muted-foreground" />
            Remove all marks
          </button>
        </div>
      )}
    </div>
  )
}
