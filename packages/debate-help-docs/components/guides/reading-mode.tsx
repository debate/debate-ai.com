"use client"
/**
 * @file reading-mode.tsx
 * @description The "Reading mode" button on the Synergy Slayer pages and the
 * full-screen reader it opens: the browser extension's reading mode, for a
 * whole paper.
 *
 * Like the extension's full-page panel, the page behind is dimmed and blurred,
 * the text sits centered on it, and the AI is a column beside it (below it on
 * a phone). The text is every page of the section, in sidebar order, loaded
 * from the pages the site already renders (`loadSectionPages` in
 * `@debate-ai/reading-mode`), so all the highlighting and card underlining
 * comes along. The header holds the same tools as the page:
 * - **Marks** (`highlight-toggle.tsx`), shared with the page: show or hide
 *   underlining and long and short highlighting, the auto modes that toggle
 *   each selection, AI marking and Reset to default highlighting. Marked
 *   passages are what the questions and answers focus on.
 * - **Voice** (`voice-read-button.tsx`), reading the whole section.
 * - **Questions** (`suggest-questions.tsx`), on by default here.
 * - **Ask AI** (`ask-ai-button`), the page's dropdown of chats, Claude first,
 *   sent the reader's text.
 * - **References** (`references-panel.tsx`): every cited card in a side
 *   panel, in the order the section cites them.
 * - **Citation hover cards**: author names keep their hover cards, rebuilt
 *   from the loaded HTML by `CitationCardsIn` (`citation-card.tsx`).
 * - **Export** (`export-menu.tsx`): the whole paper as PDF, Word, Markdown
 *   or a Google Doc.
 *
 * Escape or the close button leaves; the section stays loaded until the page
 * changes.
 */
import { useCallback, useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { BookOpen, Loader2, Sparkles, X } from "lucide-react"
import { AskAIButton } from "ask-ai-button"
import { markedPassages } from "@debate-ai/reading-mode/marks"
import { cleanContent, loadSectionPages, type LoadedSectionPage, type SectionPage } from "@debate-ai/reading-mode/sections"
import { DOCS_AI_PROVIDERS } from "../../lib/fumadocs/ask-ai-providers"
import { cn } from "../../lib/utils"
import { buttonVariants } from "../ui/button"
import { readableText } from "./docs-ai"
import { MarksMenu } from "./highlight-toggle"
import { savedAnswersPageKey } from "./saved-answers"
import { QuestionsPanel, QuestionsToggleButton } from "./suggest-questions"
import { VoiceReadButton } from "./voice-read-button"
import { CitationCardsIn } from "./citation-card"
import { ExportMenu } from "./export-menu"
import { ReferencesPanelButton } from "./references-panel"

/** Each page's content element (`SYNERGY_SLAYER_CLASS` in routes/docs-page.tsx). */
const PAGE_CONTENT_SELECTOR = ".synergy-slayer-doc"
/** Marks reading mode's text, for Voice. */
const READER_CONTENT_ATTRIBUTE = "data-reading-mode-content"
/** A whole paper is long; questions see this much of it (the extension sends 15,000 characters of an article). */
const SECTION_MAX_CHARS = 60000

const toolButton = (active: boolean) =>
  cn(
    buttonVariants({ size: "sm", className: "gap-2 [&_svg]:size-3.5 [&_svg]:text-fd-muted-foreground" }),
    active && "bg-fd-accent text-fd-accent-foreground hover:bg-fd-accent/80",
  )

/** The button beside Voice that opens reading mode for `pages` (the section, in order). */
export function ReadingModeButton({ title, pages }: { title: string; pages: SectionPage[] }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        type="button"
        aria-pressed={open}
        title="Read every page of this paper in one view, with highlighting, Voice and suggested questions"
        className={toolButton(open)}
        onClick={() => setOpen(true)}
      >
        <BookOpen />
        Reading mode
      </button>
      {open && <ReadingModeOverlay title={title} pages={pages} onClose={() => setOpen(false)} />}
    </>
  )
}

function ReadingModeOverlay({
  title,
  pages,
  onClose,
}: {
  title: string
  pages: SectionPage[]
  onClose: () => void
}) {
  const [loaded, setLoaded] = useState<LoadedSectionPage[] | null>(null)
  const [questionsOn, setQuestionsOn] = useState(true)
  const articleRef = useRef<HTMLDivElement | null>(null)
  const dialogRef = useRef<HTMLDivElement | null>(null)

  // Load every page; the one already open comes from the page itself.
  useEffect(() => {
    const controller = new AbortController()
    const here = window.location.pathname.replace(/\/$/, "")
    void loadSectionPages(pages, {
      selector: PAGE_CONTENT_SELECTOR,
      signal: controller.signal,
      local: (page) => {
        if (page.url.replace(/\/$/, "") !== here) return null
        const live = document.querySelector(PAGE_CONTENT_SELECTOR)
        return live ? cleanContent(live) : null
      },
    }).then((result) => {
      if (!controller.signal.aborted) setLoaded(result)
    })
    return () => controller.abort()
  }, [pages])

  // Escape closes (unless a menu inside took it); focus moves into the reader.
  useEffect(() => {
    dialogRef.current?.focus()
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !event.defaultPrevented && !dialogRef.current?.querySelector("[role=menu]")) onClose()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [onClose])

  // Questions focus on the marked passages, with the whole section as context.
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

  return createPortal(
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label={`Reading mode: ${title}`}
      tabIndex={-1}
      className="fixed inset-0 z-[60] flex flex-col bg-black/40 outline-none backdrop-blur-[3px]"
    >
      <div className="mx-auto flex h-full w-full max-w-7xl flex-col overflow-hidden bg-fd-background shadow-2xl md:my-4 md:h-[calc(100%-2rem)] md:rounded-xl md:border">
        <header className="flex flex-wrap items-center gap-2 border-b px-4 py-2.5">
          <BookOpen className="size-4 shrink-0 text-fd-primary" aria-hidden />
          <h2 className="mr-auto min-w-0 truncate text-sm font-semibold">{title}</h2>
          <MarksMenu contentSelector={`[${READER_CONTENT_ATTRIBUTE}]`} />
          <VoiceReadButton contentSelector={`[${READER_CONTENT_ATTRIBUTE}]`} />
          <ReferencesPanelButton contentSelector={`[${READER_CONTENT_ATTRIBUTE}]`} />
          <QuestionsToggleButton on={questionsOn} onToggle={() => setQuestionsOn((on) => !on)} />
          <AskAIButton
            title={title}
            providers={DOCS_AI_PROVIDERS}
            align="end"
            icon={<Sparkles className="size-3.5" aria-hidden />}
            getContent={() => readableText(document.querySelector(`[${READER_CONTENT_ATTRIBUTE}]`))}
          />
          <ExportMenu title={title} align="end" getRoot={() => articleRef.current} />
          {loaded && loaded.length > 1 && (
            <select
              aria-label="Jump to page"
              className="h-8 max-w-48 rounded-md border bg-fd-background px-2 text-sm"
              value=""
              onChange={(event) => jumpTo(Number(event.target.value))}
            >
              <option value="" disabled>
                Jump to…
              </option>
              {loaded.map((page, index) => (
                <option key={page.url} value={index}>
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
            {loaded ? (
              <div
                ref={articleRef}
                {...{ [READER_CONTENT_ATTRIBUTE]: "" }}
                className="synergy-slayer-doc prose mx-auto max-w-3xl px-5 py-8"
              >
                {loaded.map((page, index) => (
                  <section key={page.url} data-reading-page={index} className="scroll-mt-4">
                    {index > 0 && <hr />}
                    {page.html ? (
                      <div dangerouslySetInnerHTML={{ __html: page.html }} />
                    ) : (
                      <p>
                        <a href={page.url}>{page.title}</a> could not be loaded here.
                      </p>
                    )}
                  </section>
                ))}
                <CitationCardsIn root={articleRef} version={loaded} />
              </div>
            ) : (
              <p role="status" className="flex items-center justify-center gap-2 py-24 text-sm text-fd-muted-foreground">
                <Loader2 className="size-4 animate-spin" /> Loading all {pages.length} pages…
              </p>
            )}
          </div>
          {questionsOn && (
            <aside className="border-t p-4 md:w-96 md:shrink-0 md:overflow-y-auto md:border-l md:border-t-0">
              {loaded ? (
                <QuestionsPanel
                  getText={getText}
                  maxChars={SECTION_MAX_CHARS}
                  heading="Ask about this paper"
                  // Saved per paper (its first page, `#paper`), apart from any one page's questions.
                  savedAnswersKey={pages[0] ? savedAnswersPageKey(pages[0].url, "paper") : undefined}
                />
              ) : (
                <p className="text-sm text-fd-muted-foreground">Suggested questions appear once the pages load.</p>
              )}
            </aside>
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
}
