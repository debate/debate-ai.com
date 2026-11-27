"use client"
/**
 * @file summary-tag.tsx
 * @description The summary tag editor of the Marks menu (`highlight-toggle.tsx`):
 * a small card that opens next to highlighted text the reader selected (with
 * the "Summary tag" mode on) or clicked (a tagged highlight), asks the hosting
 * site's AI for a one-sentence summary of it (`docs-ai.ts`), and lets the
 * reader edit the text before saving it. Until the AI answers, and if it
 * fails or the reader isn't signed in, the text can simply be typed.
 *
 * Saving stores the summary as an annotation on the highlights
 * (`@debate-ai/reading-mode/summary-tags`) inside one `recordMarkChange`, so
 * Undo mark / Redo mark take it back and put it back like any mark. Every copy
 * of the menu renders one `SummaryTagCard` host; `openSummaryTag` reaches the
 * one whose content root owns the highlights.
 */
import { useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { Loader2, Sparkles, Tag, Trash2, X } from "lucide-react"
import {
  SUMMARY_MAX_LENGTH,
  SUMMARY_SYSTEM_PROMPT,
  getSummary,
  parseSummary,
  removeSummaryTag,
  setSummaryTag,
  summaryPrompt,
  summarySourceText,
} from "@debate-ai/reading-mode/summary-tags"
import { cn } from "../../lib/utils"
import { buttonVariants } from "../ui/button"
import { generateWithSite } from "./docs-ai"
import { recordMarkChange } from "./mark-history"

/** Fired on `window` to open the editor; the copy whose content root is `detail.root` answers. */
export const SUMMARY_TAG_EVENT = "debate-docs-summary-tag-open"

export interface SummaryTagRequest {
  /** The content element the highlights are in. */
  root: HTMLElement
  /** The highlights to tag (empty: the selection held none, and the card says so). */
  elements: HTMLElement[]
  /** Where the selection or click was, for placing the card. */
  anchor: { left: number; top: number; bottom: number } | null
}

export function openSummaryTag(request: SummaryTagRequest): void {
  window.dispatchEvent(new CustomEvent<SummaryTagRequest>(SUMMARY_TAG_EVENT, { detail: request }))
}

const CARD_WIDTH = 340

function Card({ request, onClose, onChanged }: { request: SummaryTagRequest; onClose: () => void; onChanged: () => void }) {
  const { root } = request
  const elements = request.elements.filter((el) => root.contains(el))
  const existing = getSummary(elements)
  const source = summarySourceText(elements)
  const [text, setText] = useState(existing)
  const [suggestion, setSuggestion] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(existing ? 0 : 1)
  const edited = useRef(false)
  const cardRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (attempt === 0 || !source) return
    const controller = new AbortController()
    setLoading(true)
    setError(null)
    generateWithSite({ system: SUMMARY_SYSTEM_PROMPT, prompt: summaryPrompt(source), maxTokens: 120, signal: controller.signal })
      .then((answer) => {
        const summary = parseSummary(answer)
        if (!summary) throw new Error("The AI didn't suggest a summary.")
        setSuggestion(summary)
        if (!edited.current) setText(summary)
      })
      .catch((reason: unknown) => {
        if (controller.signal.aborted) return
        console.warn("[docs marks] summary suggestion failed", reason)
        setError(
          reason instanceof Error && reason.name === "SignInRequiredError"
            ? "Sign in to get a suggested summary. You can still write one."
            : "Couldn't get a suggested summary. Write one below, or try again.",
        )
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })
    return () => controller.abort()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt])

  useEffect(() => {
    const onPointer = (event: PointerEvent) => {
      if (!cardRef.current?.contains(event.target as Node)) onClose()
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault()
        onClose()
      }
    }
    document.addEventListener("pointerdown", onPointer)
    document.addEventListener("keydown", onKey, true)
    return () => {
      document.removeEventListener("pointerdown", onPointer)
      document.removeEventListener("keydown", onKey, true)
    }
  }, [onClose])

  const save = () => {
    if (!text.trim() || elements.length === 0) return
    recordMarkChange(root, () => setSummaryTag(root, elements, text))
    onChanged()
    onClose()
  }

  const remove = () => {
    recordMarkChange(root, () => removeSummaryTag(root, elements))
    onChanged()
    onClose()
  }

  const anchor = request.anchor
  const left = Math.max(8, Math.min(anchor?.left ?? 8, (typeof window === "undefined" ? 1024 : window.innerWidth) - CARD_WIDTH - 8))
  const top = Math.max(8, Math.min((anchor?.bottom ?? 0) + 8, (typeof window === "undefined" ? 768 : window.innerHeight) - 280))

  return (
    <div
      ref={cardRef}
      role="dialog"
      aria-label="Summary tag"
      style={{ left, top, width: CARD_WIDTH }}
      className="fixed z-[70] max-w-[calc(100vw-1rem)] rounded-md border bg-fd-popover p-3 text-sm text-fd-popover-foreground shadow-lg"
    >
      <div className="mb-2 flex items-center gap-2 font-medium">
        <Tag className="size-4 text-fd-muted-foreground" />
        <span className="flex-1">Summary tag</span>
        <button type="button" aria-label="Close" className="rounded-sm p-0.5 hover:bg-fd-accent" onClick={onClose}>
          <X className="size-4" />
        </button>
      </div>
      {elements.length === 0 ? (
        <p className="text-fd-muted-foreground">Summary tags go on highlighted text. Select some highlighted text to add one.</p>
      ) : (
        <>
          <blockquote className="mb-2 line-clamp-3 border-l-2 pl-2 text-xs text-fd-muted-foreground">{source}</blockquote>
          <textarea
            autoFocus
            aria-label="Summary"
            value={text}
            maxLength={SUMMARY_MAX_LENGTH}
            rows={3}
            placeholder={loading ? "Suggesting a summary… or write your own" : "Write a short summary of the highlighted text"}
            className="w-full resize-none rounded-md border bg-fd-background p-2 text-sm outline-none focus:ring-2 focus:ring-fd-ring"
            onChange={(event) => {
              edited.current = true
              setText(event.target.value)
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
                event.preventDefault()
                save()
              }
            }}
          />
          <div className="mt-1 min-h-5 text-xs" aria-live="polite">
            {loading ? (
              <span className="flex items-center gap-1.5 text-fd-muted-foreground">
                <Loader2 className="size-3 animate-spin" />
                Suggesting a summary…
              </span>
            ) : error ? (
              <span role="alert" className="text-red-600 dark:text-red-400">
                {error}
              </span>
            ) : suggestion && text !== suggestion ? (
              <button
                type="button"
                className="text-fd-primary underline underline-offset-2"
                onClick={() => {
                  edited.current = false
                  setText(suggestion)
                }}
              >
                Use the suggestion
              </button>
            ) : null}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={!text.trim()}
              className={buttonVariants({ size: "sm" })}
              onClick={save}
            >
              Save
            </button>
            <button type="button" className={buttonVariants({ size: "sm", variant: "outline" })} onClick={onClose}>
              Cancel
            </button>
            <button
              type="button"
              disabled={loading}
              title="Ask the AI for another suggestion"
              className={cn(buttonVariants({ size: "sm", variant: "outline" }), "gap-1.5 [&_svg]:size-3.5")}
              onClick={() => {
                edited.current = false
                setAttempt((value) => value + 1)
              }}
            >
              <Sparkles />
              Suggest
            </button>
            {existing && (
              <button
                type="button"
                title="Remove this summary tag"
                className={cn(buttonVariants({ size: "sm", variant: "outline" }), "ml-auto gap-1.5 [&_svg]:size-3.5")}
                onClick={remove}
              >
                <Trash2 />
                Remove
              </button>
            )}
          </div>
        </>
      )}
    </div>
  )
}

/**
 * Listens for `openSummaryTag` and shows the card for the requests whose
 * `root` is this copy's (`getRoot`, looked up on use). `onChanged` runs after
 * a tag is saved or removed, so the menus can refresh.
 */
export function SummaryTagCard({ getRoot, onChanged }: { getRoot: () => HTMLElement | null; onChanged: () => void }) {
  const [request, setRequest] = useState<(SummaryTagRequest & { key: number }) | null>(null)
  useEffect(() => {
    let key = 0
    const onOpen = (event: Event) => {
      const detail = (event as CustomEvent<SummaryTagRequest>).detail
      if (detail.root !== getRoot()) return
      setRequest({ ...detail, key: key++ })
    }
    window.addEventListener(SUMMARY_TAG_EVENT, onOpen)
    return () => window.removeEventListener(SUMMARY_TAG_EVENT, onOpen)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  if (!request || typeof document === "undefined") return null
  return createPortal(<Card key={request.key} request={request} onClose={() => setRequest(null)} onChanged={onChanged} />, document.body)
}
