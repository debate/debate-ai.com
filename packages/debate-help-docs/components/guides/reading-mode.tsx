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
 * changes. The modal itself is `reading-mode-frame.tsx`, shared with the
 * References panel's per-reference reader (`reference-reading-mode.tsx`).
 */
import { useEffect, useState } from "react"
import { BookOpen } from "lucide-react"
import { cleanContent, loadSectionPages, type LoadedSectionPage, type SectionPage } from "@debate-ai/reading-mode/sections"
import { cn } from "../../lib/utils"
import { buttonVariants } from "../ui/button"
import { savedAnswersPageKey } from "./saved-answers"
import { CitationCardsIn } from "./citation-card"
import { READER_CONTENT_SELECTOR, ReadingModeFrame } from "./reading-mode-frame"
import { ReferencesPanelButton } from "./references-panel"

/** Each page's content element (`SYNERGY_SLAYER_CLASS` in routes/docs-page.tsx). */
const PAGE_CONTENT_SELECTOR = ".synergy-slayer-doc"
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

  return (
    <ReadingModeFrame
      title={title}
      onClose={onClose}
      ready={loaded !== null}
      loadingLabel={`Loading all ${pages.length} pages…`}
      tools={<ReferencesPanelButton contentSelector={READER_CONTENT_SELECTOR} />}
      jumpPages={loaded?.map((page) => ({ key: page.url, title: page.title }))}
      questions={{
        heading: "Ask about this paper",
        maxChars: SECTION_MAX_CHARS,
        // Saved per paper (its first page, `#paper`), apart from any one page's questions.
        savedAnswersKey: pages[0] ? savedAnswersPageKey(pages[0].url, "paper") : undefined,
      }}
      content={(articleRef) =>
        loaded && (
          <>
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
          </>
        )
      }
    />
  )
}
