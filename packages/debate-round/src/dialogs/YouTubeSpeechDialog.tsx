/**
 * @fileoverview "Select YouTube Start" dialog, opened from the speech timer
 * menu right under "Upload Speech Audio". A speech can come from an audio
 * file or from a YouTube video: paste a link, or search the site's own video
 * library; preview it; and mark where the speech starts and stops. "Suggest
 * with AI" reads the video's captions — where words are and where there is
 * silence — and places every speech of the format, cross-examinations
 * included, so the rest of the round's speeches can be saved in one go.
 *
 * Clips are kept per speech in localStorage (`debate-youtube-speech-<key>`),
 * beside the speech's recording.
 *
 * @module dialogs/YouTubeSpeechDialog
 */

"use client"

import type React from "react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Loader2, Pause, Play, Search, Sparkles, Upload, MonitorPlay } from "lucide-react"
import type { SpeechMenuAction } from "@debate/timer/src/recorder/SpeechRecordingPlayer"
import { saveSpeechAudioFile } from "@debate/timer/src/recorder/SpeechRecordingPlayer"
import { debateStyleMap, debateStyleNames, debateStyles } from "@debate/timer/src/formats/debate-format-times"
import {
  formatTimestamp,
  loadYouTubeSpeechClip,
  parseTimestamp,
  parseYouTubeInput,
  saveYouTubeSpeechClip,
  type SpeechSegment,
} from "@debate/timer/src/recorder/youtube-speech-segments"
import { buildEmbedUrl, startListening } from "@debate/videos/src/components/video-player/youtubeEmbed"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "../ui/primitives/dialog"
import { Button } from "../ui/primitives/button"
import { Input } from "../ui/primitives/input"
import { cn } from "../ui/lib/utils"
import { settings } from "../state/settings"
import {
  searchSiteVideos,
  styleIndexForVideoStyle,
  suggestSpeechTimestamps,
  type SiteVideo,
  type SpeechTimestampSuggestion,
} from "../round/youtube-speech-client"

export interface YouTubeSpeechDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** The speech this clip is for, e.g. `"1AC"`. */
  speechName: string
}

type Tab = "youtube" | "upload"

/** Drives a YouTube embed over the IFrame API's postMessage channel. */
function useEmbedControl(iframeRef: React.RefObject<HTMLIFrameElement | null>, videoId: string | null) {
  const [currentTime, setCurrentTime] = useState(0)
  const [playing, setPlaying] = useState(false)

  useEffect(() => {
    if (!videoId) return
    const onMessage = (event: MessageEvent) => {
      if (event.source !== iframeRef.current?.contentWindow) return
      try {
        const data = typeof event.data === "string" ? JSON.parse(event.data) : event.data
        if (data?.event === "infoDelivery" && typeof data.info?.currentTime === "number") {
          setCurrentTime(data.info.currentTime)
        }
        if (data?.event === "infoDelivery" && typeof data.info?.playerState === "number") {
          setPlaying(data.info.playerState === 1)
        }
        if (data?.event === "onStateChange" && typeof data.info === "number") setPlaying(data.info === 1)
      } catch {
        // Not a player message.
      }
    }
    window.addEventListener("message", onMessage)
    // YouTube only reports to a parent that has completed the handshake; retry until it lands.
    let attempts = 0
    const interval = setInterval(() => {
      startListening(iframeRef.current)
      if (++attempts >= 12) clearInterval(interval)
    }, 400)
    return () => {
      window.removeEventListener("message", onMessage)
      clearInterval(interval)
    }
  }, [iframeRef, videoId])

  const command = useCallback(
    (func: string, args: unknown[] = []) => {
      iframeRef.current?.contentWindow?.postMessage(JSON.stringify({ event: "command", func, args }), "https://www.youtube.com")
    },
    [iframeRef],
  )

  return {
    currentTime,
    playing,
    seek: (seconds: number) => {
      command("seekTo", [seconds, true])
      setCurrentTime(seconds)
    },
    play: () => command("playVideo"),
    pause: () => command("pauseVideo"),
  }
}

function TimeField({
  label,
  value,
  onChange,
  onUseCurrent,
  currentTime,
}: {
  label: string
  value: number | null
  onChange: (seconds: number | null) => void
  onUseCurrent: () => void
  currentTime: number
}) {
  const [text, setText] = useState(value != null ? formatTimestamp(value) : "")
  useEffect(() => setText(value != null ? formatTimestamp(value) : ""), [value])
  return (
    <label className="flex flex-col gap-1 text-xs">
      <span className="text-muted-foreground">{label}</span>
      <div className="flex gap-1">
        <Input
          value={text}
          placeholder="m:ss"
          className="h-8 w-24 font-mono text-sm"
          onChange={(e) => setText(e.target.value)}
          onBlur={() => {
            const parsed = parseTimestamp(text)
            onChange(parsed)
            if (parsed == null) setText(value != null && text.trim() ? formatTimestamp(value) : "")
          }}
        />
        <Button type="button" variant="outline" size="sm" className="h-8 text-xs" onClick={onUseCurrent}>
          Set to {formatTimestamp(currentTime)}
        </Button>
      </div>
    </label>
  )
}

export function YouTubeSpeechDialog({ open, onOpenChange, speechName }: YouTubeSpeechDialogProps) {
  const [tab, setTab] = useState<Tab>("youtube")
  const [query, setQuery] = useState("")
  const [searching, setSearching] = useState(false)
  const [results, setResults] = useState<SiteVideo[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [video, setVideo] = useState<{ videoId: string; title?: string } | null>(null)
  const [start, setStart] = useState<number | null>(null)
  const [end, setEnd] = useState<number | null>(null)
  const [styleIndex, setStyleIndex] = useState<number>(() => (settings.data.debateStyle?.value as number) ?? 0)
  const [suggesting, setSuggesting] = useState(false)
  const [suggestion, setSuggestion] = useState<SpeechTimestampSuggestion | null>(null)
  const [savedNote, setSavedNote] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const player = useEmbedControl(iframeRef, video?.videoId ?? null)
  const clipEndRef = useRef<number | null>(null)

  // Opening the dialog shows the clip already saved for this speech.
  useEffect(() => {
    if (!open) return
    const saved = loadYouTubeSpeechClip(speechName)
    setVideo(saved ? { videoId: saved.videoId, title: saved.title } : null)
    setStart(saved?.start ?? null)
    setEnd(saved?.end ?? null)
    setSuggestion(null)
    setSavedNote(null)
    setError(null)
    setStyleIndex((settings.data.debateStyle?.value as number) ?? 0)
  }, [open, speechName])

  // "Play clip" stops at the stop point.
  useEffect(() => {
    const stopAt = clipEndRef.current
    if (stopAt != null && player.currentTime >= stopAt) {
      player.pause()
      clipEndRef.current = null
    }
  }, [player])

  const styleKey = debateStyleMap[styleIndex] ?? debateStyleMap[0]
  const format = debateStyles[styleKey]
  const speeches = format?.timerSpeeches ?? []
  // The embed URL is fixed per video; seeking happens over postMessage so the player isn't reloaded.
  const embedSrc = useMemo(
    () => (video ? buildEmbedUrl(video.videoId, { startSeconds: start ?? 0 }) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [video?.videoId],
  )

  const pickVideo = (videoId: string, title?: string, startAt: number | null = null, style: number | null = null) => {
    setVideo({ videoId, title })
    setStart(startAt)
    setEnd(null)
    setSuggestion(null)
    setSavedNote(null)
    setResults(null)
    const fromVideo = styleIndexForVideoStyle(style)
    if (fromVideo != null) setStyleIndex(fromVideo)
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

  const suggest = async () => {
    if (!video) return
    setSuggesting(true)
    setError(null)
    try {
      setSuggestion(
        await suggestSpeechTimestamps({
          videoId: video.videoId,
          formatName: debateStyleNames[styleIndex] ?? styleKey,
          speeches,
          prepMinutes: format?.prepTime ?? 0,
          firstStart: start,
        }),
      )
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setSuggesting(false)
    }
  }

  const matchesThisSpeech = (segment: SpeechSegment) => segment.key.toUpperCase() === speechName.toUpperCase()

  const applySegment = (segment: SpeechSegment) => {
    setStart(Math.round(segment.start))
    setEnd(Math.round(segment.end))
    player.seek(segment.start)
  }

  const save = () => {
    if (!video || start == null) return
    saveYouTubeSpeechClip(speechName, { videoId: video.videoId, title: video.title, start, end: end ?? start + 60 * 60 })
    setSavedNote(`Saved for ${speechName}.`)
  }

  const saveAll = () => {
    if (!video || !suggestion) return
    for (const segment of suggestion.segments) {
      saveYouTubeSpeechClip(segment.key, {
        videoId: video.videoId,
        title: video.title,
        start: Math.round(segment.start),
        end: Math.round(segment.end),
      })
    }
    const mine = suggestion.segments.find(matchesThisSpeech)
    if (mine) {
      setStart(Math.round(mine.start))
      setEnd(Math.round(mine.end))
    }
    setSavedNote(`Saved ${suggestion.segments.length} speeches.`)
  }

  const playClip = () => {
    if (start == null) return
    clipEndRef.current = end
    player.seek(start)
    player.play()
  }

  const onFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ""
    if (!file) return
    setUploading(true)
    setError(null)
    saveSpeechAudioFile(file, speechName, speechName)
      .then(() => {
        setSavedNote(`Uploaded ${file.name} as ${speechName}.`)
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setUploading(false))
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MonitorPlay className="h-4 w-4" /> Speech source · {speechName}
          </DialogTitle>
          <DialogDescription>
            Upload this speech's audio, or pick a YouTube video and mark where the speech starts and stops.
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-1 border-b" role="tablist">
          {(
            [
              ["youtube", "YouTube video"],
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
        {savedNote && <p className="text-sm text-emerald-600 dark:text-emerald-400">{savedNote}</p>}

        {tab === "upload" ? (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">Choose an audio file to use as the recording for {speechName}.</p>
            <Button onClick={() => fileInputRef.current?.click()} disabled={uploading}>
              {uploading ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Upload className="h-4 w-4 mr-1" />}
              Choose audio file
            </Button>
            <input ref={fileInputRef} type="file" accept="audio/*" className="hidden" onChange={onFile} />
          </div>
        ) : (
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

            {video && embedSrc && (
              <>
                <div className="aspect-video w-full overflow-hidden rounded bg-black">
                  <iframe
                    ref={iframeRef}
                    id="youtube-speech-preview"
                    src={embedSrc}
                    title={video.title || "YouTube preview"}
                    className="h-full w-full"
                    allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
                    referrerPolicy="strict-origin-when-cross-origin"
                    onLoad={() => startListening(iframeRef.current)}
                  />
                </div>

                <div className="flex flex-wrap items-end gap-3">
                  <TimeField
                    label="Speech starts"
                    value={start}
                    onChange={setStart}
                    onUseCurrent={() => setStart(Math.floor(player.currentTime))}
                    currentTime={player.currentTime}
                  />
                  <TimeField
                    label="Speech stops"
                    value={end}
                    onChange={setEnd}
                    onUseCurrent={() => setEnd(Math.floor(player.currentTime))}
                    currentTime={player.currentTime}
                  />
                  <Button type="button" variant="outline" size="sm" className="h-8" onClick={playClip} disabled={start == null}>
                    {player.playing ? <Pause className="h-4 w-4 mr-1" /> : <Play className="h-4 w-4 mr-1" />}
                    Play clip
                  </Button>
                  <Button type="button" size="sm" className="h-8" onClick={save} disabled={start == null}>
                    Save for {speechName}
                  </Button>
                </div>
                {start != null && end != null && end <= start && (
                  <p className="text-xs text-destructive">The stop point is before the start point.</p>
                )}

                <section className="space-y-2 rounded border p-2">
                  <div className="flex flex-wrap items-end gap-2">
                    <label className="flex flex-col gap-1 text-xs">
                      <span className="text-muted-foreground">Format</span>
                      <select
                        className="h-8 rounded-md border bg-background px-2 text-sm"
                        value={styleIndex}
                        onChange={(e) => {
                          setStyleIndex(Number(e.target.value))
                          setSuggestion(null)
                        }}
                      >
                        {debateStyleMap.map((key, i) =>
                          debateStyles[key]?.timerSpeeches?.length ? (
                            <option key={key} value={i}>
                              {debateStyleNames[i]} ({debateStyles[key].timerSpeeches.length} speeches)
                            </option>
                          ) : null,
                        )}
                      </select>
                    </label>
                    <Button type="button" size="sm" className="h-8" onClick={() => void suggest()} disabled={suggesting}>
                      {suggesting ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Sparkles className="h-4 w-4 mr-1" />}
                      Suggest all speeches with AI
                    </Button>
                    {suggestion && (
                      <Button type="button" variant="outline" size="sm" className="h-8" onClick={saveAll}>
                        Save all {suggestion.segments.length}
                      </Button>
                    )}
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Reads the captions for where words are spoken and where there's silence, then fits the{" "}
                    {speeches.length} speeches (with cross-ex and prep time) to the format's speech lengths.
                    {start != null ? " Starts from your start point." : ""}
                  </p>
                  {suggesting && (
                    <p className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Loader2 className="h-3 w-3 animate-spin" /> Reading captions and placing speeches…
                    </p>
                  )}
                  {suggestion && (
                    <>
                      <p className="text-xs text-muted-foreground">{suggestion.notes}</p>
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="text-left text-muted-foreground">
                            <th className="py-0.5 font-medium">Speech</th>
                            <th className="font-medium">Start</th>
                            <th className="font-medium">Stop</th>
                            <th className="font-medium">Length</th>
                            <th />
                          </tr>
                        </thead>
                        <tbody>
                          {suggestion.segments.map((segment) => (
                            <tr key={segment.key} className={cn(matchesThisSpeech(segment) && "bg-primary/10 font-medium")}>
                              <td className="py-0.5">{segment.key}</td>
                              <td className="font-mono">{formatTimestamp(segment.start)}</td>
                              <td className="font-mono">{formatTimestamp(segment.end)}</td>
                              <td className="font-mono text-muted-foreground">
                                {formatTimestamp(segment.end - segment.start)} / {formatTimestamp(segment.expectedSeconds)}
                              </td>
                              <td className="text-right">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 px-2 text-xs"
                                  onClick={() => applySegment(segment)}
                                >
                                  Use
                                </Button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </>
                  )}
                </section>
              </>
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
export function useYouTubeSpeechAction(speechName: string): {
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
    dialog: <YouTubeSpeechDialog open={open} onOpenChange={setOpen} speechName={speechName} />,
  }
}
