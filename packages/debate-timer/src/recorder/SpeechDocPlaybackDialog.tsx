/**
 * @fileoverview "Speech doc playback": the joined round recording played
 * back beside each speech's speech doc. The doc sits on one side, scrolled
 * to the card being read at that moment; the other side shows the caption
 * line being said at the top and, in the bottom corner, an H1/H2/H3 outline
 * of the speech to flow from.
 *
 * Which card was read when is estimated (`recorder/speech-doc-sync.ts`):
 * matched against the transcript when there is one, else spread by reading
 * pace. The docs come from the caller's `loadSpeechDoc` (in a round,
 * `debate-round` supplies the linked editor doc or the flow's speech doc).
 *
 * @module recorder/SpeechDocPlaybackDialog
 */

"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { Dialog as DialogPrimitive } from "radix-ui"
import { Loader2, Sparkles, X } from "lucide-react"
import { Button } from "../ui/primitives/button"
import { cn } from "../ui/lib/utils"
import { effectiveStarts, formatClock, speechAtTime, type RoundRecordingManifest } from "./round-recording"
import { activeCaptionIndex, buildCaptionWords, type CaptionWord } from "./speech-captions"
import { loadSpokenTranscript } from "./spoken-words-store"
import { buildTranscriptLines } from "./transcript-sections"
import {
  activeOutlineIndex,
  captionLineAt,
  docOutline,
  loadSpeechOutline,
  parseWebVtt,
  requestSpeechOutline,
  saveSpeechOutline,
  sectionAtTime,
  shiftTimings,
  signpostOutline,
  speechDocSections,
  syncSpeechDoc,
  type DocParagraph,
  type DocSection,
  type OutlineItem,
  type SectionTiming,
  type SyncMethod,
} from "./speech-doc-sync"

/** Loads a speech's doc (HTML or markdown); null when it has none. */
export type SpeechDocLoader = (speechKey: string) => Promise<string | null>

export interface SpeechDocPlaybackDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  roundId: string
  manifest: RoundRecordingManifest
  audioUrl: string
  /** The joined recording's WebVTT captions, when it was joined with captions. */
  vtt: string | null
  /** Where to start playing, in seconds. */
  initialTime?: number
  loadSpeechDoc?: SpeechDocLoader
}

/** Everything worked out for one speech of the joined recording. */
interface SpeechView {
  key: string
  label: string
  start: number
  sections: DocSection[]
  /** Absolute times in the joined recording. */
  timings: SectionTiming[]
  method: SyncMethod | null
  lines: Array<{ start: number; text: string }>
  outline: OutlineItem[]
  outlineSource: "doc" | "ai" | "signposts" | "none"
}

/** Caption words for the whole joined recording: its VTT, else each speech's live transcript moved to its start. */
function joinedCaptionWords(manifest: RoundRecordingManifest, vtt: string | null): CaptionWord[] {
  const cues = parseWebVtt(vtt)
  if (cues.length > 0) return buildCaptionWords({ text: "", segments: cues })
  const starts = effectiveStarts(manifest)
  return manifest.speeches.flatMap((speech) => {
    const start = starts[speech.key] ?? speech.start
    return buildCaptionWords(loadSpokenTranscript(speech.key), speech.duration).map((w) => ({
      word: w.word,
      start: w.start + start,
      end: w.end + start,
    }))
  })
}

/** What an AI outline was made from; a re-join or moved speech start makes a new one. */
function outlineVersion(lines: SpeechView["lines"]): string {
  return `${lines[0]?.start ?? 0}:${lines.length}:${lines[lines.length - 1]?.start ?? 0}`
}

const HEADING_CLASS: Record<number, string> = {
  1: "text-lg font-bold",
  2: "text-base font-bold",
  3: "text-sm font-bold",
  4: "text-sm font-semibold",
}

function Paragraph({ paragraph }: { paragraph: DocParagraph }) {
  return (
    <p className={cn("leading-relaxed", paragraph.level ? HEADING_CLASS[paragraph.level] : "text-xs", paragraph.analytic && "italic")}>
      {paragraph.runs.map((run, i) => (
        <span
          key={i}
          className={cn(
            run.highlight && "bg-yellow-200 text-black dark:bg-yellow-500/60 dark:text-white",
            run.underline && "underline",
            run.bold && "font-bold",
            paragraph.level == null && !run.highlight && !run.underline && !run.bold && "text-muted-foreground",
          )}
        >
          {run.text}
        </span>
      ))}
    </p>
  )
}

const OUTLINE_INDENT: Record<1 | 2 | 3, string> = { 1: "", 2: "pl-4", 3: "pl-8" }
const OUTLINE_TEXT: Record<1 | 2 | 3, string> = { 1: "font-bold", 2: "font-semibold", 3: "" }
const OUTLINE_SOURCE: Record<SpeechView["outlineSource"], string> = {
  doc: "from the speech doc",
  ai: "AI summary of the transcript",
  signposts: "signposts in the transcript",
  none: "",
}

export function SpeechDocPlaybackDialog({
  open,
  onOpenChange,
  roundId,
  manifest,
  audioUrl,
  vtt,
  initialTime = 0,
  loadSpeechDoc,
}: SpeechDocPlaybackDialogProps) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const docPaneRef = useRef<HTMLDivElement>(null)
  const sectionRefs = useRef<Map<string, HTMLElement>>(new Map())
  const [time, setTime] = useState(initialTime)
  const [docs, setDocs] = useState<Record<string, string | null>>({})
  const [loadingDocs, setLoadingDocs] = useState(false)
  const [follow, setFollow] = useState(true)
  const [revealAsSpoken, setRevealAsSpoken] = useState(true)
  const [aiOutlines, setAiOutlines] = useState<Record<string, OutlineItem[]>>({})
  const [aiBusy, setAiBusy] = useState(false)
  const [aiError, setAiError] = useState<string | null>(null)

  useEffect(() => {
    if (open) setTime(initialTime)
  }, [open, initialTime])

  // Load every speech's doc once the view opens.
  useEffect(() => {
    if (!open || !loadSpeechDoc) return
    let cancelled = false
    setLoadingDocs(true)
    void Promise.all(
      manifest.speeches.map(async (speech) => {
        try {
          return [speech.key, await loadSpeechDoc(speech.key)] as const
        } catch {
          return [speech.key, null] as const
        }
      }),
    ).then((entries) => {
      if (cancelled) return
      setDocs(Object.fromEntries(entries))
      setLoadingDocs(false)
    })
    return () => {
      cancelled = true
    }
  }, [open, loadSpeechDoc, manifest.speeches])

  const starts = useMemo(() => effectiveStarts(manifest), [manifest])
  const captionWords = useMemo(() => (open ? joinedCaptionWords(manifest, vtt) : []), [open, manifest, vtt])
  const captionLines = useMemo(() => buildTranscriptLines(captionWords, 14), [captionWords])

  const views = useMemo<SpeechView[]>(() => {
    const ordered = [...manifest.speeches].sort((a, b) => (starts[a.key] ?? a.start) - (starts[b.key] ?? b.start))
    return ordered.map((speech, i) => {
      const start = starts[speech.key] ?? speech.start
      const next = ordered[i + 1]
      const end = Math.min(start + speech.duration, next ? (starts[next.key] ?? next.start) : Infinity)
      const words = captionWords
        .filter((w) => w.start >= start && w.start < end)
        .map((w) => ({ ...w, start: w.start - start, end: w.end - start }))
      const lines = buildTranscriptLines(words).map((line) => ({ start: line.start + start, text: line.text }))
      const sections = speechDocSections(docs[speech.key])
      const sync = sections.length ? syncSpeechDoc(sections, words, Math.max(0, end - start)) : null
      const timings = sync ? shiftTimings(sync.timings, start) : []
      const ai = aiOutlines[speech.key] ?? loadSpeechOutline(roundId, speech.key, outlineVersion(lines))
      const fromDoc = docOutline(sections, timings)
      let outline: OutlineItem[] = []
      let outlineSource: SpeechView["outlineSource"] = "none"
      if (ai?.length) [outline, outlineSource] = [ai, "ai"]
      else if (fromDoc.length) [outline, outlineSource] = [fromDoc, "doc"]
      else if (lines.length) [outline, outlineSource] = [signpostOutline(lines), "signposts"]
      return { key: speech.key, label: speech.label, start, sections, timings, method: sync?.method ?? null, lines, outline, outlineSource }
    })
  }, [manifest.speeches, starts, captionWords, docs, aiOutlines, roundId])

  const currentKey = speechAtTime(starts, time) ?? views[0]?.key ?? null
  const [shownKey, setShownKey] = useState<string | null>(null)
  // The doc follows the speech being played unless the user picked another tab.
  const viewKey = follow ? currentKey : (shownKey ?? currentKey)
  const view = views.find((v) => v.key === viewKey) ?? null
  const playingView = views.find((v) => v.key === currentKey) ?? null
  const currentSection = playingView ? sectionAtTime(playingView.timings, time) : null

  // Keep the card being read in view.
  useEffect(() => {
    if (!follow || currentKey == null || currentSection == null) return
    const el = sectionRefs.current.get(`${currentKey}:${currentSection}`)
    const pane = docPaneRef.current
    if (!el || !pane) return
    pane.scrollTo({ top: Math.max(0, el.offsetTop - pane.clientHeight / 4), behavior: "smooth" })
  }, [follow, currentKey, currentSection])

  const activeWord = activeCaptionIndex(captionWords, time)
  const caption = captionLineAt(captionLines, captionWords, activeWord)
  const previousLine = caption && caption.line > 0 ? captionLines[caption.line - 1] : null

  const outline = playingView?.outline ?? []
  const activeOutline = activeOutlineIndex(outline, time)
  const outlineRef = useRef<HTMLOListElement>(null)
  useEffect(() => {
    const el = outlineRef.current?.querySelector<HTMLElement>("[data-active='true']")
    el?.scrollIntoView({ block: "nearest", behavior: "smooth" })
  }, [activeOutline, currentKey])

  const seek = (seconds: number) => {
    const audio = audioRef.current
    if (audio) {
      audio.currentTime = seconds
      if (audio.paused) void audio.play().catch(() => {})
    }
    setTime(seconds)
  }

  const handleAiOutline = async () => {
    if (!playingView) return
    setAiBusy(true)
    setAiError(null)
    try {
      const items = await requestSpeechOutline(playingView.label, playingView.lines)
      saveSpeechOutline(roundId, playingView.key, outlineVersion(playingView.lines), items)
      setAiOutlines((prev) => ({ ...prev, [playingView.key]: items }))
    } catch (e) {
      setAiError(e instanceof Error ? e.message : "Could not outline the speech.")
    } finally {
      setAiBusy(false)
    }
  }

  const hasDoc = !!view && view.sections.length > 0

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/60" />
        <DialogPrimitive.Content className="fixed inset-2 z-50 flex flex-col gap-2 rounded-lg border bg-background p-3 shadow-lg sm:inset-6">
          <div className="flex flex-wrap items-center gap-2">
            <DialogPrimitive.Title className="text-base font-semibold">Speech doc playback</DialogPrimitive.Title>
            <ol className="flex flex-1 flex-wrap gap-1 text-[11px]" aria-label="Speeches">
              {views.map((v) => (
                <li key={v.key}>
                  <button
                    type="button"
                    onClick={() => {
                      setShownKey(v.key)
                      seek(v.start)
                    }}
                    className={cn(
                      "rounded border px-1.5 py-0.5 tabular-nums",
                      v.key === currentKey ? "bg-primary text-primary-foreground" : v.key === viewKey ? "bg-muted" : "hover:bg-muted",
                    )}
                  >
                    {v.label} {formatClock(v.start)}
                  </button>
                </li>
              ))}
            </ol>
            <label className="flex items-center gap-1 text-[11px] text-muted-foreground">
              <input type="checkbox" checked={follow} onChange={(e) => setFollow(e.target.checked)} />
              Follow along
            </label>
            <DialogPrimitive.Close asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7" aria-label="Close">
                <X className="h-4 w-4" />
              </Button>
            </DialogPrimitive.Close>
          </div>
          <DialogPrimitive.Description className="sr-only">
            The round recording beside each speech's speech doc, with live captions and an outline to flow from.
          </DialogPrimitive.Description>

          <div className="grid min-h-0 flex-1 grid-cols-1 gap-2 md:grid-cols-2">
            {/* Speech doc, scrolled to the card being read. */}
            <section className="flex min-h-0 flex-col rounded border" aria-label="Speech doc">
              <header className="flex items-center gap-2 border-b px-2 py-1 text-[11px] text-muted-foreground">
                <span className="font-semibold text-foreground">{view?.label ?? "Speech"} speech doc</span>
                {view?.method && (
                  <span title="Nothing records which card was on screen, so it is estimated.">
                    · card estimated {view.method === "transcript" ? "by matching the transcript" : "from reading pace"}
                  </span>
                )}
                {loadingDocs && <Loader2 className="h-3 w-3 animate-spin" aria-label="Loading speech docs" />}
              </header>
              <div ref={docPaneRef} className="relative min-h-0 flex-1 space-y-2 overflow-y-auto p-2">
                {!hasDoc && !loadingDocs && (
                  <p className="text-xs text-muted-foreground">
                    {loadSpeechDoc
                      ? "This speech has no speech doc. Link one from the speech header, or write it in the flow's speech doc."
                      : "Speech docs aren't available here."}
                  </p>
                )}
                {view?.sections.map((section) => {
                  const timing = view.timings.find((t) => t.section === section.index)
                  const active = view.key === currentKey && section.index === currentSection
                  return (
                    <article
                      key={section.index}
                      ref={(el) => {
                        const id = `${view.key}:${section.index}`
                        if (el) sectionRefs.current.set(id, el)
                        else sectionRefs.current.delete(id)
                      }}
                      data-active={active || undefined}
                      className={cn(
                        "space-y-1 rounded border-l-4 px-2 py-1 transition-colors",
                        active ? "border-primary bg-primary/10" : "border-transparent",
                      )}
                    >
                      {timing && (
                        <button
                          type="button"
                          onClick={() => seek(timing.start)}
                          className="float-right text-[10px] tabular-nums text-muted-foreground hover:text-foreground"
                          title="Play from here"
                        >
                          {formatClock(timing.start)}
                        </button>
                      )}
                      {section.paragraphs.map((p, i) => (
                        <Paragraph key={i} paragraph={p} />
                      ))}
                    </article>
                  )
                })}
              </div>
            </section>

            {/* Captions on top, the flowable outline in the bottom corner. */}
            <section className="flex min-h-0 flex-col gap-2" aria-label="Captions and outline">
              <div className="rounded border p-3" aria-live="polite">
                <div className="mb-1 text-[11px] text-muted-foreground">
                  {playingView ? `${playingView.label} · ${formatClock(time)}` : formatClock(time)}
                </div>
                {caption ? (
                  <>
                    {previousLine && <p className="truncate text-xs text-muted-foreground">{previousLine.text}</p>}
                    <p className="text-lg leading-snug">
                      {caption.words.map((w, i) => (
                        <span
                          key={i}
                          className={cn(
                            i === caption.active && "rounded bg-primary px-0.5 text-primary-foreground",
                            i > caption.active && "text-muted-foreground",
                          )}
                        >
                          {w.word}{" "}
                        </span>
                      ))}
                    </p>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    {captionWords.length ? "Captions start when the speech does." : "No captions. Join the recording with captions turned on."}
                  </p>
                )}
                {playingView && currentSection != null && playingView.sections[currentSection] && (
                  <p className="mt-2 truncate border-t pt-1 text-[11px] text-muted-foreground">
                    Reading: <span className="font-semibold text-foreground">{playingView.sections[currentSection].title}</span>
                  </p>
                )}
              </div>

              <div className="flex-1" />

              <div className="ml-auto flex max-h-[55%] min-h-0 w-full flex-col rounded border md:w-[90%]">
                <header className="flex flex-wrap items-center gap-2 border-b px-2 py-1 text-[11px]">
                  <span className="font-semibold">Outline to flow</span>
                  {playingView && OUTLINE_SOURCE[playingView.outlineSource] && (
                    <span className="text-muted-foreground">· {OUTLINE_SOURCE[playingView.outlineSource]}</span>
                  )}
                  <label className="ml-auto flex items-center gap-1 text-muted-foreground">
                    <input type="checkbox" checked={revealAsSpoken} onChange={(e) => setRevealAsSpoken(e.target.checked)} />
                    Reveal as spoken
                  </label>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-6 gap-1 px-1.5 text-[11px]"
                    onClick={() => void handleAiOutline()}
                    disabled={aiBusy || !playingView?.lines.length}
                    title="Summarize the transcript into an H1/H2/H3 outline with AI"
                  >
                    {aiBusy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                    AI outline
                  </Button>
                </header>
                {aiError && <p className="px-2 pt-1 text-[11px] text-red-600 dark:text-red-400" role="alert">{aiError}</p>}
                <ol ref={outlineRef} className="min-h-0 flex-1 space-y-0.5 overflow-y-auto p-2 text-xs">
                  {outline.length === 0 && <li className="text-muted-foreground">Nothing to outline yet.</li>}
                  {outline.map((item, i) => {
                    if (revealAsSpoken && i > activeOutline) return null
                    return (
                      <li
                        key={i}
                        data-active={i === activeOutline}
                        className={cn(OUTLINE_INDENT[item.level], i === activeOutline && "rounded bg-primary/10")}
                      >
                        <button type="button" onClick={() => seek(item.start)} className="flex w-full gap-1 text-left">
                          <span aria-hidden>{item.level === 1 ? "■" : item.level === 2 ? "●" : "–"}</span>
                          <span className={OUTLINE_TEXT[item.level]}>{item.text}</span>
                        </button>
                      </li>
                    )
                  })}
                </ol>
              </div>
            </section>
          </div>

          <audio
            ref={audioRef}
            src={audioUrl}
            controls
            className="w-full"
            onLoadedMetadata={(e) => {
              e.currentTarget.currentTime = initialTime
            }}
            onTimeUpdate={(e) => setTime(e.currentTarget.currentTime)}
            onSeeked={(e) => setTime(e.currentTarget.currentTime)}
          />
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
