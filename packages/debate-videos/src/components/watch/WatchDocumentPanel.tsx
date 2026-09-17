/**
 * @fileoverview A long-form document beside the video — the typed-up
 * transcript of every speech, the AI summary, the written analysis.
 *
 * This is the reading half of the watch page's side tabs. The other one,
 * {@link WatchTranscriptPanel}, shows YouTube's caption cues: hundreds of
 * three-second fragments that follow playback and are useless to read
 * linearly. A document is the opposite — it is written to be read, runs to
 * tens of thousands of words, and has to stay navigable at that length. So:
 *
 *   - the `##` headings become a jump list, which for a round means a list of
 *     its speeches;
 *   - a heading that named a timecode seeks the video, so the round can be
 *     read and watched at the same time;
 *   - search filters to matching paragraphs and highlights them in place,
 *     because Ctrl+F through a 10,000-word column finds the first hit and
 *     then loses the reader.
 * @module components/watch/WatchDocumentPanel
 */

"use client"

import { useMemo, useRef, useState } from "react"
import { Bot, ListTree, Search, X } from "lucide-react"
import { ScrollArea } from "../../ui/primitives/scroll-area"
import {
  formatTimecode,
  parseDocumentSections,
  toParagraphs,
  VIDEO_DOCUMENT_LABELS,
  type VideoDocument,
} from "../../lib/video-documents"

interface WatchDocumentPanelProps {
  document: VideoDocument
  /** Seeks the player; absent when the document carries no timecodes. */
  onSeek?: (seconds: number) => void
}

/** Splits a paragraph on a search term so the matches can be marked. */
function highlightParts(text: string, needle: string): Array<{ text: string; match: boolean }> {
  if (!needle) return [{ text, match: false }]

  const parts: Array<{ text: string; match: boolean }> = []
  const haystack = text.toLowerCase()
  let index = 0

  for (;;) {
    const found = haystack.indexOf(needle, index)
    if (found === -1) break
    if (found > index) parts.push({ text: text.slice(index, found), match: false })
    parts.push({ text: text.slice(found, found + needle.length), match: true })
    index = found + needle.length
  }

  if (index < text.length) parts.push({ text: text.slice(index), match: false })
  return parts
}

export function WatchDocumentPanel({ document, onSeek }: WatchDocumentPanelProps) {
  const [query, setQuery] = useState("")
  const [isOutlineOpen, setIsOutlineOpen] = useState(false)
  const sectionRefs = useRef<Array<HTMLElement | null>>([])

  const sections = useMemo(() => parseDocumentSections(document.body), [document.body])
  const needle = query.trim().toLowerCase()

  /**
   * Sections with their paragraphs, narrowed to the ones that match a
   * search. A section whose heading matches keeps all of its paragraphs —
   * searching "2NR" should hand over the whole speech, not the one line that
   * happens to say so.
   */
  const rendered = useMemo(
    () =>
      sections
        .map((section, index) => {
          const paragraphs = toParagraphs(section.body)
          if (!needle) return { section, index, paragraphs }
          if (section.heading.toLowerCase().includes(needle)) {
            return { section, index, paragraphs }
          }
          return {
            section,
            index,
            paragraphs: paragraphs.filter((paragraph) =>
              paragraph.toLowerCase().includes(needle),
            ),
          }
        })
        .filter(({ paragraphs, section }) => {
          if (!needle) return true
          return paragraphs.length > 0 || section.heading.toLowerCase().includes(needle)
        }),
    [sections, needle],
  )

  const totalWords = useMemo(
    () => sections.reduce((total, section) => total + section.wordCount, 0),
    [sections],
  )
  const outline = useMemo(() => sections.filter((section) => section.heading), [sections])
  const matchCount = useMemo(() => {
    if (!needle) return 0
    return rendered.reduce(
      (total, { paragraphs }) =>
        total +
        paragraphs.filter((paragraph) => paragraph.toLowerCase().includes(needle)).length,
      0,
    )
  }, [rendered, needle])

  const jumpTo = (index: number) => {
    setIsOutlineOpen(false)
    sectionRefs.current[index]?.scrollIntoView({ block: "start", behavior: "smooth" })
  }

  const heading = document.title || VIDEO_DOCUMENT_LABELS[document.kind].label
  const isGenerated = document.author === "ai"

  return (
    <div className="flex flex-col min-h-0 flex-1">
      <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-border shrink-0">
        <div className="flex items-center gap-1.5 min-w-0">
          {isGenerated && <Bot className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground truncate">
            {heading}
          </h3>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[10px] tabular-nums text-muted-foreground">
            {needle ? `${matchCount} match${matchCount === 1 ? "" : "es"}` : `${totalWords.toLocaleString()} words`}
          </span>
          {outline.length > 1 && (
            <button
              type="button"
              onClick={() => setIsOutlineOpen((open) => !open)}
              aria-expanded={isOutlineOpen}
              aria-label="Jump to a speech"
              className={`rounded p-0.5 transition-colors ${
                isOutlineOpen ? "text-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <ListTree className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {isOutlineOpen && outline.length > 1 && (
        <nav className="border-b border-border bg-muted/30 p-2 shrink-0 max-h-48 overflow-y-auto">
          <ul className="space-y-0.5">
            {sections.map((section, index) =>
              section.heading ? (
                <li key={index}>
                  <button
                    type="button"
                    onClick={() => jumpTo(index)}
                    className="flex w-full items-baseline justify-between gap-2 rounded px-1.5 py-1 text-left text-xs hover:bg-accent transition-colors"
                  >
                    <span className="truncate">{section.heading}</span>
                    <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground">
                      {section.startSeconds !== null
                        ? formatTimecode(section.startSeconds)
                        : `${section.wordCount.toLocaleString()}w`}
                    </span>
                  </button>
                </li>
              ) : null,
            )}
          </ul>
        </nav>
      )}

      <div className="relative px-2 py-2 border-b border-border shrink-0">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={`Search the ${VIDEO_DOCUMENT_LABELS[document.kind].label.toLowerCase()}`}
          aria-label="Search this document"
          className="w-full rounded-md border border-border bg-background pl-8 pr-7 py-1.5 text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        {query && (
          <button
            onClick={() => setQuery("")}
            aria-label="Clear document search"
            className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      <ScrollArea className="flex-1 min-h-0 h-[320px] lg:h-auto">
        <div className="space-y-4 p-3">
          {rendered.length === 0 && (
            <p className="text-sm text-muted-foreground">
              {needle ? `Nothing matches “${query.trim()}”.` : "This document is empty."}
            </p>
          )}

          {rendered.map(({ section, index, paragraphs }) => (
            <section
              key={index}
              ref={(el) => {
                sectionRefs.current[index] = el
              }}
              className="scroll-mt-2 space-y-1.5"
            >
              {section.heading && (
                <div className="flex items-baseline gap-2">
                  {section.startSeconds !== null && onSeek ? (
                    <button
                      type="button"
                      onClick={() => onSeek(section.startSeconds as number)}
                      aria-label={`Play from ${formatTimecode(section.startSeconds)}`}
                      className="shrink-0 text-[10px] tabular-nums text-muted-foreground hover:text-primary transition-colors"
                    >
                      {formatTimecode(section.startSeconds)}
                    </button>
                  ) : (
                    section.startSeconds !== null && (
                      <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground">
                        {formatTimecode(section.startSeconds)}
                      </span>
                    )
                  )}
                  <h4 className="text-sm font-semibold leading-snug">{section.heading}</h4>
                </div>
              )}

              {paragraphs.map((paragraph, paragraphIndex) => (
                <p
                  key={paragraphIndex}
                  className="text-sm leading-relaxed text-muted-foreground whitespace-pre-line"
                >
                  {highlightParts(paragraph, needle).map((part, partIndex) =>
                    part.match ? (
                      <mark
                        key={partIndex}
                        className="rounded bg-yellow-200 px-0.5 text-foreground dark:bg-yellow-500/30"
                      >
                        {part.text}
                      </mark>
                    ) : (
                      <span key={partIndex}>{part.text}</span>
                    ),
                  )}
                </p>
              ))}

              {section.heading && paragraphs.length === 0 && !needle && (
                <p className="text-xs italic text-muted-foreground">Not transcribed yet.</p>
              )}
            </section>
          ))}
        </div>
      </ScrollArea>

      {isGenerated && (
        <p className="border-t border-border px-3 py-1.5 text-[10px] text-muted-foreground shrink-0">
          Generated{document.model ? ` by ${document.model}` : ""} — check it against the video
          before relying on it.
        </p>
      )}
    </div>
  )
}
