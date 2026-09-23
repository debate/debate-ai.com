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
 *     then loses the reader;
 *   - bodies render as markdown (see {@link renderDocumentMarkdown}), so a
 *     pasted summary's bold, lists and links read as intended;
 *   - a speeches document opens with its table of contents showing, marks
 *     the speech playing now, and — unless the reader turned auto-scroll off
 *     — follows playback from speech to speech.
 * @module components/watch/WatchDocumentPanel
 */

"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { Bot, ListTree, Search, X } from "lucide-react"
import { ScrollArea } from "../../ui/primitives/scroll-area"
import {
  formatTimecode,
  parseDocumentSections,
  toParagraphs,
  VIDEO_DOCUMENT_LABELS,
  type VideoDocument,
} from "../../lib/video-documents"
import { highlightHtml, renderDocumentMarkdown } from "../../lib/document-markdown"
import { scrollWithin } from "../../lib/scroll-within"
import { AutoScrollToggle } from "./AutoScrollToggle"

interface WatchDocumentPanelProps {
  document: VideoDocument
  /** Seeks the player; absent when the document carries no timecodes. */
  onSeek?: (seconds: number) => void
  /** Playback position, which marks — and follows — the speech playing now. */
  currentTime?: number
  /** Whether the panel follows playback between timed sections. */
  autoScroll?: boolean
  onAutoScrollChange?: (value: boolean) => void
}

/**
 * Typography for rendered markdown. The app has no typography plugin, so the
 * handful of elements a summary uses are styled here, sized to the panel.
 */
const MARKDOWN_CLASSES = [
  "text-sm leading-relaxed text-muted-foreground break-words",
  "[&_p]:my-1.5 [&_p:first-child]:mt-0 [&_p:last-child]:mb-0",
  "[&_ul]:my-1.5 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:my-1.5 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:my-0.5",
  "[&_h1]:text-sm [&_h2]:text-sm [&_h3]:text-sm [&_h4]:text-sm [&_h5]:text-xs [&_h6]:text-xs",
  "[&_h4]:font-semibold [&_h5]:font-semibold [&_h6]:font-semibold [&_h4]:text-foreground [&_h4]:mt-3 [&_h4]:mb-1",
  "[&_strong]:font-semibold [&_strong]:text-foreground [&_em]:italic",
  "[&_a]:text-primary [&_a]:underline [&_a]:underline-offset-2",
  "[&_blockquote]:my-2 [&_blockquote]:border-l-2 [&_blockquote]:border-border [&_blockquote]:pl-3 [&_blockquote]:italic",
  "[&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-xs",
  "[&_pre]:my-2 [&_pre]:overflow-x-auto [&_pre]:rounded [&_pre]:bg-muted [&_pre]:p-2",
  "[&_hr]:my-3 [&_hr]:border-border [&_img]:max-w-full [&_img]:rounded",
  "[&_table]:my-2 [&_table]:w-full [&_table]:text-xs [&_th]:border [&_th]:border-border [&_th]:px-1.5 [&_th]:py-1 [&_th]:text-left",
  "[&_td]:border [&_td]:border-border [&_td]:px-1.5 [&_td]:py-1",
  "[&_mark]:rounded [&_mark]:bg-yellow-200 [&_mark]:px-0.5 [&_mark]:text-foreground dark:[&_mark]:bg-yellow-500/30",
].join(" ")

/** Splits a heading on a search term so the matches can be marked. */
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

export function WatchDocumentPanel({
  document,
  onSeek,
  currentTime = 0,
  autoScroll = true,
  onAutoScrollChange,
}: WatchDocumentPanelProps) {
  const [query, setQuery] = useState("")
  // The speeches document is navigated by speech, so its contents start
  // open; a summary or analysis keeps them one click away.
  const [isOutlineOpen, setIsOutlineOpen] = useState(document.kind === "transcript")
  const sectionRefs = useRef<Array<HTMLElement | null>>([])

  useEffect(() => {
    setIsOutlineOpen(document.kind === "transcript")
  }, [document.kind, document.videoId])

  const sections = useMemo(() => parseDocumentSections(document.body), [document.body])
  const needle = query.trim().toLowerCase()

  /**
   * Sections with their rendered markdown, narrowed to the ones that match a
   * search. A section whose heading matches keeps all of its paragraphs —
   * searching "2NR" should hand over the whole speech, not the one line that
   * happens to say so.
   */
  const rendered = useMemo(
    () =>
      sections
        .map((section, index) => {
          const paragraphs = toParagraphs(section.body)
          const kept =
            !needle || section.heading.toLowerCase().includes(needle)
              ? paragraphs
              : paragraphs.filter((paragraph) => paragraph.toLowerCase().includes(needle))
          const html = kept.length > 0 ? highlightHtml(renderDocumentMarkdown(kept.join("\n\n")), needle) : ""
          return { section, index, paragraphs: kept, html }
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
  const isTimed = useMemo(() => sections.some((section) => section.startSeconds !== null), [sections])
  const matchCount = useMemo(() => {
    if (!needle) return 0
    return rendered.reduce(
      (total, { paragraphs }) =>
        total +
        paragraphs.filter((paragraph) => paragraph.toLowerCase().includes(needle)).length,
      0,
    )
  }, [rendered, needle])

  /** The last section whose timecode playback has passed — the speech on now. */
  const playingIndex = useMemo(() => {
    let found = -1
    sections.forEach((section, index) => {
      if (section.startSeconds !== null && section.startSeconds <= currentTime) found = index
    })
    return found
  }, [sections, currentTime])

  // Follow playback from speech to speech — only on a change of speech, so a
  // reader scrolled into the middle of one is left there until the next
  // begins, and never while they are reading their own search results.
  useEffect(() => {
    if (!autoScroll || needle || playingIndex < 0) return
    scrollWithin(sectionRefs.current[playingIndex])
  }, [autoScroll, needle, playingIndex])

  const jumpTo = (index: number) => {
    scrollWithin(sectionRefs.current[index])
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
          {isTimed && onAutoScrollChange && (
            <AutoScrollToggle checked={autoScroll} onChange={onAutoScrollChange} />
          )}
          <span className="text-[10px] tabular-nums text-muted-foreground">
            {needle ? `${matchCount} match${matchCount === 1 ? "" : "es"}` : `${totalWords.toLocaleString()} words`}
          </span>
          {outline.length > 1 && (
            <button
              type="button"
              onClick={() => setIsOutlineOpen((open) => !open)}
              aria-expanded={isOutlineOpen}
              aria-label={isOutlineOpen ? "Hide table of contents" : "Show table of contents"}
              title="Table of contents"
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
        <nav
          aria-label="Table of contents"
          className="border-b border-border bg-muted/30 p-2 shrink-0 max-h-40 overflow-y-auto"
        >
          <p className="px-1.5 pb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Contents
          </p>
          <ol className="space-y-0.5">
            {sections.map((section, index) =>
              section.heading ? (
                <li key={index}>
                  <button
                    type="button"
                    onClick={() => jumpTo(index)}
                    aria-current={index === playingIndex ? "true" : undefined}
                    className={`flex w-full items-baseline justify-between gap-2 rounded px-1.5 py-1 text-left text-xs transition-colors ${
                      index === playingIndex ? "bg-accent text-foreground font-medium" : "hover:bg-accent"
                    }`}
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
          </ol>
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

      <ScrollArea className="flex-1 min-h-0">
        <div className="space-y-4 p-3">
          {rendered.length === 0 && (
            <p className="text-sm text-muted-foreground">
              {needle ? `Nothing matches “${query.trim()}”.` : "This document is empty."}
            </p>
          )}

          {rendered.map(({ section, index, paragraphs, html }) => (
            <section
              key={index}
              ref={(el) => {
                sectionRefs.current[index] = el
              }}
              data-playing={index === playingIndex ? "true" : undefined}
              className={`space-y-1.5 ${
                index === playingIndex ? "-mx-1.5 rounded-md border-l-2 border-primary bg-accent/30 px-1.5 py-1" : ""
              }`}
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
                  <h4 className="text-sm font-semibold leading-snug">
                    {highlightParts(section.heading, needle).map((part, partIndex) =>
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
                  </h4>
                </div>
              )}

              {html && (
                <div
                  className={MARKDOWN_CLASSES}
                  // Sanitized by renderDocumentMarkdown: raw HTML is escaped
                  // and only http(s)/mailto URLs survive.
                  dangerouslySetInnerHTML={{ __html: html }}
                />
              )}

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
