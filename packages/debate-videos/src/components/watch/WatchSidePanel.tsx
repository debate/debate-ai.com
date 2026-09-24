/**
 * @fileoverview The tabbed column beside the video on the watch page.
 *
 * The column used to hold one thing: YouTube's caption cues, synced to
 * playback. That is the right thing to have open *while* watching and the
 * wrong thing to read afterwards — the cues are three-second fragments with
 * no speakers, no speech boundaries and no punctuation to speak of. So the
 * column is now a tab strip over everything a video can carry beside it:
 *
 *   0. **By speech** — for a video with an AI summary or a written
 *      analysis, the round one tab per speech (see {@link WatchRoundPanel}).
 *      It opens first when present, since it is what those documents are for.
 *   1. **Captions** — the synced cues, unchanged, the default otherwise.
 *   2. **Speeches / Summary** — the long-form documents: the round typed up
 *      speech by speech, and the AI summary of it.
 *   3. **Analysis** — the videos an editor has tied to this one.
 *
 * Tabs a video has nothing for are not rendered, so a lecture with neither
 * documents nor linked analysis gets exactly the caption panel it had before
 * and no empty chrome around it. A video with even one document does get the
 * strip, though — a lone Summary still reads as a named tab.
 *
 * Every tab scrolls inside the column's fixed height (set by the watch
 * page), and one shared "Auto-scroll" checkbox, remembered per browser,
 * decides whether captions and timed speeches follow playback.
 * @module components/watch/WatchSidePanel
 */

"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { WatchTranscriptPanel } from "./WatchTranscriptPanel"
import { WatchDocumentPanel } from "./WatchDocumentPanel"
import { WatchAnalysisPanel, type LinkedVideo } from "./WatchAnalysisPanel"
import { WatchRoundPanel, type SpeechFocusRequest } from "./WatchRoundPanel"
import { buildRoundSpeeches } from "../../lib/round-speeches"
import {
  orderDocuments,
  VIDEO_DOCUMENT_LABELS,
  type VideoDocument,
} from "../../lib/video-documents"
import type { TranscriptSnippet } from "../transcript/transcriptUtils"

interface WatchSidePanelProps {
  /** YouTube's caption cues, already regrouped into sentences. */
  sentences: TranscriptSnippet[]
  captionsLoading: boolean
  /** Long-form documents for this video. See {@link VideoDocument}. */
  documents?: VideoDocument[]
  /** Videos an editor tied to this one. See {@link LinkedVideo}. */
  links?: LinkedVideo[]
  currentTime: number
  onSeek: (seconds: number) => void
  /** A speech the timeline under the player asked to show; opens "By speech". */
  focusSpeech?: SpeechFocusRequest | null
  /** The video, for the per-speech Outcomes view. */
  videoId?: string
  videoTitle?: string
}

/** Where the reader's auto-scroll choice is remembered. */
export const AUTO_SCROLL_STORAGE_KEY = "debate-videos:watch-auto-scroll"

function readAutoScroll(): boolean {
  try {
    return window.localStorage.getItem(AUTO_SCROLL_STORAGE_KEY) !== "off"
  } catch {
    return true
  }
}

/** One tab in the strip. */
interface PanelTab {
  id: string
  label: string
  /** Word count or item count shown under the label. */
  hint?: string
}

export function WatchSidePanel({
  sentences,
  captionsLoading,
  documents = [],
  links = [],
  currentTime,
  onSeek,
  focusSpeech,
  videoId,
  videoTitle,
}: WatchSidePanelProps) {
  const ordered = useMemo(() => orderDocuments(documents), [documents])
  const speeches = useMemo(() => buildRoundSpeeches(documents), [documents])
  const hasCaptions = sentences.length > 0 || captionsLoading

  const tabs = useMemo<PanelTab[]>(() => {
    const list: PanelTab[] = []
    if (speeches.length > 0) {
      list.push({ id: "round", label: "By speech", hint: `${speeches.filter((speech) => speech.isSpeech).length} speeches` })
    }
    if (hasCaptions) {
      list.push({
        id: "captions",
        label: "Captions",
        hint: sentences.length > 0 ? `${sentences.length.toLocaleString()} lines` : undefined,
      })
    }
    for (const document of ordered) {
      list.push({
        id: `document:${document.kind}`,
        label: document.title || VIDEO_DOCUMENT_LABELS[document.kind].label,
        hint: document.wordCount ? `${document.wordCount.toLocaleString()} words` : undefined,
      })
    }
    if (links.length > 0) {
      list.push({ id: "analysis", label: "Analysis", hint: `${links.length} video${links.length === 1 ? "" : "s"}` })
    }
    return list
  }, [speeches.length, hasCaptions, sentences.length, ordered, links.length])

  const [activeId, setActiveId] = useState<string | null>(null)
  // Starts on, then picks up the stored choice after mount so the server
  // render and the first client render agree.
  const [autoScroll, setAutoScrollState] = useState(true)
  useEffect(() => {
    setAutoScrollState(readAutoScroll())
  }, [])
  const setAutoScroll = useCallback((value: boolean) => {
    setAutoScrollState(value)
    try {
      window.localStorage.setItem(AUTO_SCROLL_STORAGE_KEY, value ? "on" : "off")
    } catch {
      // Storage blocked — the choice still holds for this page.
    }
  }, [])

  // Keep the selection on a tab that still exists: captions arrive after the
  // first paint (and can fail outright), and moving between two watch pages
  // reuses this component with a different set of tabs entirely.
  useEffect(() => {
    setActiveId((current) => {
      if (current && tabs.some((tab) => tab.id === current)) return current
      return tabs[0]?.id ?? null
    })
  }, [tabs])

  useEffect(() => {
    if (focusSpeech) setActiveId("round")
  }, [focusSpeech])

  if (tabs.length === 0) return null

  const active = activeId ?? tabs[0].id
  const activeDocument = active.startsWith("document:")
    ? ordered.find((document) => `document:${document.kind}` === active)
    : undefined

  return (
    <aside className="flex flex-col min-h-0 flex-1 rounded-lg border border-border bg-card/40 overflow-hidden">
      {(tabs.length > 1 || ordered.length > 0) && (
        <div role="tablist" aria-label="Beside this video" className="flex shrink-0 border-b border-border">
          {tabs.map((tab) => {
            const isActive = tab.id === active
            return (
              <button
                key={tab.id}
                role="tab"
                type="button"
                aria-selected={isActive}
                onClick={() => setActiveId(tab.id)}
                className={`flex-1 min-w-0 px-2 py-1.5 text-center transition-colors ${
                  isActive
                    ? "bg-background text-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent/40"
                }`}
              >
                <span className="block truncate text-xs font-medium">{tab.label}</span>
                {tab.hint && (
                  <span className="block truncate text-[10px] tabular-nums text-muted-foreground">
                    {tab.hint}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      )}

      {active === "round" && (
        <WatchRoundPanel
          speeches={speeches}
          documents={ordered}
          currentTime={currentTime}
          onSeek={onSeek}
          autoScroll={autoScroll}
          onAutoScrollChange={setAutoScroll}
          focusRequest={focusSpeech}
          videoId={videoId ?? documents[0]?.videoId}
          videoTitle={videoTitle}
        />
      )}

      {active === "captions" && (
        <WatchTranscriptPanel
          sentences={sentences}
          loading={captionsLoading}
          currentTime={currentTime}
          onSeek={onSeek}
          embedded
          autoScroll={autoScroll}
          onAutoScrollChange={setAutoScroll}
        />
      )}

      {activeDocument && (
        <WatchDocumentPanel
          document={activeDocument}
          onSeek={onSeek}
          currentTime={currentTime}
          autoScroll={autoScroll}
          onAutoScrollChange={setAutoScroll}
        />
      )}

      {active === "analysis" && <WatchAnalysisPanel links={links} />}
    </aside>
  )
}
