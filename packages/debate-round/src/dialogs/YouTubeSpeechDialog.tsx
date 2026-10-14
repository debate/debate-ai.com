/**
 * @fileoverview "Select YouTube Start" dialog, opened from the speech timer
 * menu right under "Upload Speech Audio". A speech can come from an audio
 * file or from a recording of the round: a YouTube video (paste a link, or
 * search the site's own video library) or an audio file by URL, such as the
 * round's joined MP3 of every recorded speech. Either recording is labelled
 * the same way, with {@link SpeechStartLabeler}: preview it, mark where the
 * speech starts and stops, and have AI place every speech of the format.
 *
 * @module dialogs/YouTubeSpeechDialog
 */

"use client"

import type React from "react"
import { useEffect, useRef, useState } from "react"
import { FileAudio, Loader2, MonitorPlay, Search, Upload } from "lucide-react"
import type { SpeechMenuAction } from "@debate/timer/src/recorder/SpeechRecordingPlayer"
import { saveSpeechAudioFile } from "@debate/timer/src/recorder/SpeechRecordingPlayer"
import {
  loadSpeechMediaClip,
  parseYouTubeInput,
  type CaptionSnippet,
  type SpeechMediaSource,
  type SpeechSegment,
} from "@debate/timer/src/recorder/youtube-speech-segments"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "../ui/primitives/dialog"
import { Button } from "../ui/primitives/button"
import { Input } from "../ui/primitives/input"
import { cn } from "../ui/lib/utils"
import { searchSiteVideos, styleIndexForVideoStyle, type SiteVideo } from "../round/youtube-speech-client"
import { SpeechStartLabeler } from "./SpeechStartLabeler"

/** A round recording the host already has, e.g. the joined MP3 in R2. */
export interface RoundAudioRecording {
  url: string
  title: string
  /** Where each speech is known to start, e.g. where each recording was joined in. */
  segments?: SpeechSegment[]
  /** The recording's captions, for "Suggest all speeches". */
  loadCaptions?: () => Promise<{ snippets: CaptionSnippet[]; unavailable?: string }>
  /** Store the labelled starts with the recording. */
  onSaveAll?: (segments: SpeechSegment[]) => void
}

export interface YouTubeSpeechDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** The speech this clip is for, e.g. `"1AC"`. */
  speechName: string
  /** The round's joined recording, offered on the "Round audio" tab. */
  roundAudio?: RoundAudioRecording | null
}

type Tab = "youtube" | "audio" | "upload"

export function YouTubeSpeechDialog({ open, onOpenChange, speechName, roundAudio }: YouTubeSpeechDialogProps) {
  const [tab, setTab] = useState<Tab>("youtube")
  const [query, setQuery] = useState("")
  const [searching, setSearching] = useState(false)
  const [results, setResults] = useState<SiteVideo[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [note, setNote] = useState<string | null>(null)
  const [video, setVideo] = useState<{ videoId: string; title?: string; start: number | null; styleIndex?: number } | null>(
    null,
  )
  const [audioUrl, setAudioUrl] = useState("")
  const [audio, setAudio] = useState<{ url: string; title: string } | null>(null)
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Opening the dialog shows the recording already saved for this speech.
  useEffect(() => {
    if (!open) return
    const saved = loadSpeechMediaClip(speechName)
    const source: SpeechMediaSource | undefined = saved?.source
    setVideo(source?.kind === "youtube" ? { videoId: source.videoId, title: saved?.title, start: null } : null)
    setAudio(source?.kind === "audio" ? { url: source.url, title: saved?.title ?? "Audio" } : null)
    setTab(source?.kind === "audio" ? "audio" : "youtube")
    setResults(null)
    setError(null)
    setNote(null)
  }, [open, speechName])

  const pickVideo = (videoId: string, title?: string, start: number | null = null, style: number | null = null) => {
    setVideo({ videoId, title, start, styleIndex: styleIndexForVideoStyle(style) ?? undefined })
    setResults(null)
  }

  const submitQuery = async () => {
    setError(null)
    const link = parseYouTubeInput(query)
    if (link) {
      pickVideo(link.videoId, undefined, link.start)
      return
    }
    if (!query.trim()) return
    setSearching(true)
    try {
      setResults(await searchSiteVideos(query))
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setSearching(false)
    }
  }

  const loadAudioUrl = () => {
    const url = audioUrl.trim()
    if (!url) return
    setError(null)
    try {
      const parsed = new URL(url, window.location.href)
      if (!/^https?:$/.test(parsed.protocol)) throw new Error("not http")
      setAudio({ url: parsed.href, title: decodeURIComponent(parsed.pathname.split("/").pop() || "Audio") })
    } catch {
      setError("That isn't an audio link.")
    }
  }

  const onFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ""
    if (!file) return
    setUploading(true)
    setError(null)
    saveSpeechAudioFile(file, speechName, speechName)
      .then(() => setNote(`Uploaded ${file.name} as ${speechName}.`))
      .catch((e: Error) => setError(e.message))
      .finally(() => setUploading(false))
  }

  const usingRoundAudio = roundAudio && audio?.url === roundAudio.url ? roundAudio : null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MonitorPlay className="h-4 w-4" /> Speech source · {speechName}
          </DialogTitle>
          <DialogDescription>
            Upload this speech's audio, or pick a recording of the round and mark where the speech starts and stops.
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-1 border-b" role="tablist">
          {(
            [
              ["youtube", "YouTube video"],
              ["audio", "Round audio (MP3)"],
              ["upload", "Upload audio"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={tab === key}
              className={cn(
                "px-3 py-1.5 text-sm border-b-2 -mb-px",
                tab === key ? "border-primary font-medium" : "border-transparent text-muted-foreground",
              )}
              onClick={() => setTab(key)}
            >
              {label}
            </button>
          ))}
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}
        {note && <p className="text-sm text-emerald-600 dark:text-emerald-400">{note}</p>}

        {tab === "upload" && (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">Choose an audio file to use as the recording for {speechName}.</p>
            <Button onClick={() => fileInputRef.current?.click()} disabled={uploading}>
              {uploading ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Upload className="h-4 w-4 mr-1" />}
              Choose audio file
            </Button>
            <input ref={fileInputRef} type="file" accept="audio/*" className="hidden" onChange={onFile} />
          </div>
        )}

        {tab === "audio" && (
          <div className="space-y-3">
            {roundAudio && (
              <Button
                type="button"
                variant={usingRoundAudio ? "default" : "outline"}
                size="sm"
                onClick={() => setAudio({ url: roundAudio.url, title: roundAudio.title })}
              >
                <FileAudio className="h-4 w-4 mr-1" /> {roundAudio.title}
              </Button>
            )}
            <form
              className="flex gap-1"
              onSubmit={(e) => {
                e.preventDefault()
                loadAudioUrl()
              }}
            >
              <Input
                value={audioUrl}
                onChange={(e) => setAudioUrl(e.target.value)}
                placeholder="Link to an MP3 of the round"
                className="h-8 text-sm"
                aria-label="Audio link"
              />
              <Button type="submit" size="sm" className="h-8">
                Load
              </Button>
            </form>
            {audio && (
              <SpeechStartLabeler
                source={{ kind: "audio", url: audio.url }}
                title={audio.title}
                speechName={speechName}
                initialSegments={usingRoundAudio?.segments}
                loadCaptions={usingRoundAudio?.loadCaptions}
                onSaveAll={usingRoundAudio?.onSaveAll}
              />
            )}
          </div>
        )}

        {tab === "youtube" && (
          <div className="space-y-3">
            <form
              className="flex gap-1"
              onSubmit={(e) => {
                e.preventDefault()
                void submitQuery()
              }}
            >
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Paste a YouTube link, or search the site's videos"
                className="h-8 text-sm"
                aria-label="YouTube link or search"
              />
              <Button type="submit" size="sm" className="h-8" disabled={searching}>
                {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              </Button>
            </form>

            {results && (
              <ul className="max-h-48 overflow-y-auto rounded border divide-y" aria-label="Video results">
                {results.length === 0 && <li className="p-2 text-xs text-muted-foreground">No videos found.</li>}
                {results.map((v) => (
                  <li key={v.videoId}>
                    <button
                      type="button"
                      className="flex w-full items-center gap-2 p-1.5 text-left hover:bg-muted"
                      onClick={() => pickVideo(v.videoId, v.title, null, v.style)}
                    >
                      <img
                        src={`https://i.ytimg.com/vi/${v.videoId}/default.jpg`}
                        alt=""
                        className="h-9 w-16 shrink-0 rounded object-cover"
                        loading="lazy"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-xs font-medium">{v.title}</span>
                        <span className="block truncate text-[11px] text-muted-foreground">
                          {v.channel}
                          {v.publishedAt ? ` · ${v.publishedAt}` : ""}
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {video && (
              <SpeechStartLabeler
                source={{ kind: "youtube", videoId: video.videoId }}
                title={video.title}
                speechName={speechName}
                initialStart={video.start}
                styleIndex={video.styleIndex}
              />
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

/**
 * The speech menu's "Select YouTube Start" item plus the dialog it opens —
 * pass `action` in `SpeechRecordingMenu`'s `uploadActions` and render `dialog`.
 */
export function useYouTubeSpeechAction(
  speechName: string,
  roundAudio?: RoundAudioRecording | null,
): {
  action: SpeechMenuAction
  dialog: React.ReactNode
} {
  const [open, setOpen] = useState(false)
  return {
    action: {
      key: "youtube-speech-start",
      label: "Select YouTube Start",
      icon: <MonitorPlay className="h-4 w-4 mr-2" />,
      onSelect: () => setOpen(true),
    },
    dialog: <YouTubeSpeechDialog open={open} onOpenChange={setOpen} speechName={speechName} roundAudio={roundAudio} />,
  }
}
