"use client"
/**
 * @file reading-mode-frame.tsx
 * @description The full-screen reading mode modal itself, whatever it is
 * reading: the dimmed, blurred page behind, the text centered on it and the AI
 * as a column beside it (below it on a phone). The header holds the tools:
 * Marks, Voice, Questions, Ask AI, Export, a page jump list, and any extra
 * `tools` the reader adds (the section reader adds References).
 *
 * Two readers use it: a whole paper (`reading-mode.tsx`: every page of a
 * Synergy Slayer section) and one reference's source article
 * (`reference-reading-mode.tsx`: the References panel's Reading mode button).
 * Both get the same highlighting, voice, questions and export; they differ
 * only in what they put in the text column.
 *
 * Escape or the close button leaves. A `nested` frame opens over another
 * reading mode (and the References panel inside it), so it sits above them and
 * takes Escape first.
 */
import { useCallback, useEffect, useRef, useState, type ReactNode, type RefObject } from "react"
import { createPortal } from "react-dom"
import { BookOpen, Loader2, Sparkles, X } from "lucide-react"
import { AskAIButton } from "ask-ai-button"
import { markedPassages } from "@debate-ai/reading-mode/marks"
import { DOCS_AI_PROVIDERS } from "../../lib/fumadocs/ask-ai-providers"
import { readableText } from "./docs-ai"
import { MarksMenu } from "./highlight-toggle"
import { QuestionsPanel, QuestionsToggleButton } from "./suggest-questions"
import { VoiceReadButton } from "./voice-read-button"
import { ExportMenu } from "./export-menu"

/** Marks reading mode's text, for Voice, Marks and Ask AI. */
export const READER_CONTENT_ATTRIBUTE = "data-reading-mode-content"
/** Marks a reading mode opened over another one (the reference reader). */
export const NESTED_READER_ATTRIBUTE = "data-reading-mode-nested"
export const READER_CONTENT_SELECTOR = `[${READER_CONTENT_ATTRIBUTE}]`

export interface ReadingModeFrameProps {
  title: string
  onClose: () => void
  /** The text has loaded, so the questions can read it. */
  ready: boolean
  /** Shown beside a spinner until `content` returns something. */
  loadingLabel: string
  /** The text, given the element that holds it; `null` while it loads. */
  content: (articleRef: RefObject<HTMLDivElement | null>) => ReactNode
  /** Replaces the text with a message: an error, or "could not find the article". */
  notice?: ReactNode
  /** Above the text, outside what Voice, Marks and the AI read. */
  banner?: ReactNode
  /** Extra header buttons, after Voice. */
  tools?: ReactNode
  /** The pages `content` marks with `data-reading-page`, for the "Jump to…" list. */
  jumpPages?: { key: string; title: string }[]
  questions: { heading: string; maxChars: number; savedAnswersKey?: string }
  nested?: boolean
  /** The Ask AI and Export title. */
  exportTitle?: string
}

const SMALL_TEXT_STATUS = "py-24 text-sm text-fd-muted-foreground"

/** The reading mode modal (see the module doc). */
export function ReadingModeFrame({
  title,
  onClose,
  ready,
  loadingLabel,
  content,
  notice,
  banner,
  tools,
  jumpPages,
  questions,
  nested = false,
  exportTitle = title,
}: ReadingModeFrameProps) {
  const [questionsOn, setQuestionsOn] = useState(true)
  const articleRef = useRef<HTMLDivElement | null>(null)
  const dialogRef = useRef<HTMLDivElement | null>(null)

  // Escape closes (unless a menu inside took it); focus moves into the reader.
  useEffect(() => {
    dialogRef.current?.focus()
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented || dialogRef.current?.querySelector("[role=menu]")) return
      // A nested reader sits over another reader and its panel: take Escape before they do.
      if (nested) {
        event.preventDefault()
        event.stopPropagation()
      }
      onClose()
    }
    window.addEventListener("keydown", onKey, nested)
    return () => window.removeEventListener("keydown", onKey, nested)
  }, [onClose, nested])

  // Questions focus on the marked passages, with the whole text as context.
  const getText = useCallback(() => {
    const root = articleRef.current
    const text = readableText(root)
    const marked = root ? markedPassages(root) : []
    if (marked.length === 0) return text
    return `Passages the reader highlighted (focus on these):\n${marked.map((passage) => `- ${passage}`).join("\n")}\n\nFull text:\n${text}`
  }, [])

  const jumpTo = (index: number) => {
    articleRef.current
      ?.querySelector(`[data-reading-page="${index}"]`)
      ?.scrollIntoView({ behavior: "smooth", block: "start" })
  }

  const body = notice ? null : content(articleRef)
  const showQuestions = questionsOn && !notice

  return createPortal(
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label={`Reading mode: ${title}`}
      tabIndex={-1}
      {...(nested ? { [NESTED_READER_ATTRIBUTE]: "" } : {})}
      className={`fixed inset-0 ${nested ? "z-[80]" : "z-[60]"} flex flex-col bg-black/40 outline-none backdrop-blur-[3px]`}
    >
      <div className="mx-auto flex h-full w-full max-w-7xl flex-col overflow-hidden bg-fd-background shadow-2xl md:my-4 md:h-[calc(100%-2rem)] md:rounded-xl md:border">
        <header className="flex flex-wrap items-center gap-2 border-b px-4 py-2.5">
          <BookOpen className="size-4 shrink-0 text-fd-primary" aria-hidden />
          <h2 className="mr-auto min-w-0 truncate text-sm font-semibold">{title}</h2>
          <MarksMenu contentSelector={READER_CONTENT_SELECTOR} />
          <VoiceReadButton contentSelector={READER_CONTENT_SELECTOR} />
          {tools}
          <QuestionsToggleButton on={questionsOn} onToggle={() => setQuestionsOn((on) => !on)} />
          <AskAIButton
            title={title}
            providers={DOCS_AI_PROVIDERS}
            align="end"
            icon={<Sparkles className="size-3.5" aria-hidden />}
            getContent={() => readableText(document.querySelector(READER_CONTENT_SELECTOR))}
          />
          <ExportMenu title={exportTitle} align="end" getRoot={() => articleRef.current} />
          {jumpPages && jumpPages.length > 1 && (
            <select
              aria-label="Jump to page"
              className="h-8 max-w-48 rounded-md border bg-fd-background px-2 text-sm"
              value=""
              onChange={(event) => jumpTo(Number(event.target.value))}
            >
              <option value="" disabled>
                Jump to…
              </option>
              {jumpPages.map((page, index) => (
                <option key={page.key} value={index}>
                  {page.title}
                </option>
              ))}
            </select>
          )}
          <button
            type="button"
            aria-label="Close reading mode (Esc)"
            title="Close reading mode (Esc)"
            className="rounded-md p-1.5 text-fd-muted-foreground hover:bg-fd-accent"
            onClick={onClose}
          >
            <X className="size-4" />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto md:flex md:overflow-hidden">
          <div className="min-w-0 md:flex-1 md:overflow-y-auto">
            {banner}
            {notice ? (
              notice
            ) : body ? (
              <div
                ref={articleRef}
                {...{ [READER_CONTENT_ATTRIBUTE]: "" }}
                className="synergy-slayer-doc prose mx-auto max-w-3xl px-5 py-8"
              >
                {body}
              </div>
            ) : (
              <p role="status" className={`flex items-center justify-center gap-2 ${SMALL_TEXT_STATUS}`}>
                <Loader2 className="size-4 animate-spin" /> {loadingLabel}
              </p>
            )}
          </div>
          {showQuestions && (
            <aside className="border-t p-4 md:w-96 md:shrink-0 md:overflow-y-auto md:border-l md:border-t-0">
              {ready ? (
                <QuestionsPanel
                  getText={getText}
                  maxChars={questions.maxChars}
                  heading={questions.heading}
                  savedAnswersKey={questions.savedAnswersKey}
                />
              ) : (
                <p className="text-sm text-fd-muted-foreground">Suggested questions appear once the text loads.</p>
              )}
            </aside>
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
}
