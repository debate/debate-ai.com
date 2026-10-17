/**
 * @fileoverview Label where speeches start and stop on a recording — one
 * component for both sources a round's speeches can come from: a YouTube
 * video (any round video, pasted or found in the site's library) and an audio
 * file, such as the round's joined MP3 of every recorded speech.
 *
 * It renders the player (a YouTube embed or an `<audio>` element) behind one
 * {@link MediaControl} and every speech's start and stop in `debate-timer`'s
 * `SpeechStartsEditor` — the same editor as the joined-MP3 dialog and the
 * watch page — with "Play clip", "Save for" the current speech, and
 * "Suggest all speeches with AI", which fills the editor: the recording's captions
 * are split at silences and every speech of the format, cross-ex included, is
 * fitted to them by rule length (`debate-timer`'s `suggestSpeechSegments`),
 * then refined by the AI. Clips are saved per speech with
 * `saveSpeechMediaClip`; YouTube starts are also written to the watch page's
 * speech marks so both places agree.
 *
 * @module dialogs/SpeechStartLabeler
 */

"use client"

import type React from "react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Loader2, Pause, Play, Sparkles } from "lucide-react"
import { SpeechStartsEditor } from "@debate/timer/src/recorder/SpeechStartsEditor"
import { debateStyleMap, debateStyleNames, debateStyles } from "@debate/timer/src/formats/debate-format-times"
import {
  loadSpeechMediaClip,
  sameMediaSource,
  saveSpeechMediaClip,
  speechSegmentKeys,
  type CaptionSnippet,
  type SpeechMediaSource,
  type SpeechSegment,
} from "@debate/timer/src/recorder/youtube-speech-segments"
import { buildEmbedUrl, startListening } from "@debate/videos/src/components/videos/video-player/youtubeEmbed"
import { standardRoundSpeeches } from "@debate/videos/src/lib/round-formats"
import { writeSpeechStart } from "@debate/videos/src/state/speechStartMarks"
import { Button } from "../ui/primitives/button"
import { settings } from "../state/settings"
import {
  fetchCaptions,
  suggestSpeechTimestamps,
  videoStyleForStyleIndex,
  type SpeechTimestampSuggestion,
} from "../round/youtube-speech-client"

/** Playback of whatever the labeler is showing, YouTube or audio. */
export interface MediaControl {
  currentTime: number
  /** Length in seconds; 0 until the player reports it. */
  duration: number
  playing: boolean
  seek: (seconds: number) => void
  play: () => void
  pause: () => void
}

/** Drives a YouTube embed over the IFrame API's postMessage channel. */
export function useYouTubeEmbedControl(
  iframeRef: React.RefObject<HTMLIFrameElement | null>,
  videoId: string | null,
): MediaControl {
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
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
        if (data?.event === "infoDelivery" && typeof data.info?.duration === "number" && data.info.duration > 0) {
          setDuration(data.info.duration)
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
    duration,
    playing,
    seek: (seconds) => {
      command("seekTo", [seconds, true])
      setCurrentTime(seconds)
    },
    play: () => command("playVideo"),
    pause: () => command("pauseVideo"),
  }
}

/** Drives an `<audio>` element — e.g. the round's joined MP3. */
export function useAudioElementControl(audioRef: React.RefObject<HTMLAudioElement | null>): MediaControl {
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [playing, setPlaying] = useState(false)

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    const onTime = () => setCurrentTime(audio.currentTime)
    const onDuration = () => setDuration(Number.isFinite(audio.duration) ? audio.duration : 0)
    const onPlay = () => setPlaying(true)
    const onPause = () => setPlaying(false)
    audio.addEventListener("timeupdate", onTime)
    audio.addEventListener("durationchange", onDuration)
    audio.addEventListener("play", onPlay)
    audio.addEventListener("pause", onPause)
    return () => {
      audio.removeEventListener("timeupdate", onTime)
      audio.removeEventListener("durationchange", onDuration)
      audio.removeEventListener("play", onPlay)
      audio.removeEventListener("pause", onPause)
    }
  })

  return {
    currentTime,
    duration,
    playing,
    seek: (seconds) => {
      if (audioRef.current) audioRef.current.currentTime = seconds
      setCurrentTime(seconds)
    },
    play: () => void audioRef.current?.play().catch(() => {}),
    pause: () => audioRef.current?.pause(),
  }
}

/** A speech the labeler shows a row for. */
interface SpeechRow {
  key: string
  name: string
  /** The rule length of the speech, in seconds. */
  expectedSeconds: number
}

const rowOf = ({ key, name, expectedSeconds }: SpeechSegment): SpeechRow => ({ key, name, expectedSeconds })

/** `{ key: seconds }` with `key` set, or removed for `null`. */
function withTime(times: Record<string, number>, key: string, seconds: number | null): Record<string, number> {
  const next = { ...times }
  if (seconds == null) delete next[key]
  else next[key] = seconds
  return next
}

/**
 * Also mark YouTube starts on the watch page's timeline, when the format's
 * speech order there lines up one to one with the timer's.
 */
function syncWatchPageMarks(videoId: string, styleIndex: number, segments: SpeechSegment[]) {
  const watchSpeeches = standardRoundSpeeches(videoStyleForStyleIndex(styleIndex) ?? undefined)
  if (watchSpeeches.length !== segments.length) return
  segments.forEach((segment, i) => writeSpeechStart(videoId, watchSpeeches[i].key, segment.start))
}

export interface SpeechStartLabelerProps {
  /** What to play: a YouTube video or an audio file URL. */
  source: SpeechMediaSource
  /** The video's title or the file's name. */
  title?: string
  /** The speech being labelled, e.g. `"1AC"`; its row is highlighted and "Save" saves it. */
  speechName: string
  /** Start to show before anything is saved, e.g. a link's `t=`. */
  initialStart?: number | null
  /** Starts already known, e.g. where each recording was joined into the MP3. */
  initialSegments?: SpeechSegment[]
  /** `debateStyles` index of the recording's format; defaults to the round's setting. */
  styleIndex?: number
  /**
   * The recording's captions for "Suggest all speeches". Defaults to the
   * YouTube video's from `/api/transcript`; an audio source has none unless
   * given, and then speeches are laid out by rule length from the start point.
   */
  loadCaptions?: () => Promise<{ snippets: CaptionSnippet[]; unavailable?: string }>
  /** Called with every speech's placement after "Save all", e.g. to store them with the MP3. */
  onSaveAll?: (segments: SpeechSegment[]) => void
}

export function SpeechStartLabeler({
  source,
  title,
  speechName,
  initialStart = null,
  initialSegments,
  styleIndex: styleIndexProp,
  loadCaptions,
  onSaveAll,
}: SpeechStartLabelerProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const audioRef = useRef<HTMLAudioElement>(null)
  const youtube = useYouTubeEmbedControl(iframeRef, source.kind === "youtube" ? source.videoId : null)
  const audio = useAudioElementControl(audioRef)
  const player = source.kind === "youtube" ? youtube : audio

  const [styleIndex, setStyleIndex] = useState<number>(
    () => styleIndexProp ?? ((settings.data.debateStyle?.value as number) ?? 0),
  )
  // The rows shown: the known or suggested speeches, else the format's.
  const [placedRows, setPlacedRows] = useState<SpeechRow[] | null>(() => initialSegments?.map(rowOf) ?? null)
  const [starts, setStarts] = useState<Record<string, number>>({})
  const [ends, setEnds] = useState<Record<string, number>>({})
  const [suggesting, setSuggesting] = useState(false)
  const [suggestionNotes, setSuggestionNotes] = useState<string | null>(null)
  const [note, setNote] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const clipEndRef = useRef<number | null>(null)
  const sourceId = source.kind === "youtube" ? source.videoId : source.url

  const styleKey = debateStyleMap[styleIndex] ?? debateStyleMap[0]
  const format = debateStyles[styleKey]
  const speeches = useMemo(() => format?.timerSpeeches ?? [], [format])
  const rows = useMemo(() => {
    const keys = speechSegmentKeys(speeches)
    const base =
      placedRows ?? speeches.map((speech, i) => ({ key: keys[i], name: speech.name, expectedSeconds: speech.time * 60 }))
    // The speech being labelled always has a row, even when the format doesn't name it.
    return base.some((row) => row.key.toUpperCase() === speechName.toUpperCase())
      ? base
      : [{ key: speechName, name: speechName, expectedSeconds: 0 }, ...base]
  }, [placedRows, speeches, speechName])
  const myKey = rows.find((row) => row.key.toUpperCase() === speechName.toUpperCase())?.key ?? speechName
  const start = starts[myKey] ?? null
  const end = ends[myKey] ?? null

  // A new recording: each speech's saved clip on it, else a known start; this speech also takes the link's start.
  useEffect(() => {
    const nextStarts: Record<string, number> = {}
    const nextEnds: Record<string, number> = {}
    for (const segment of initialSegments ?? []) {
      nextStarts[segment.key] = segment.start
      nextEnds[segment.key] = segment.end
    }
    for (const row of rows) {
      const saved = loadSpeechMediaClip(row.key)
      if (saved && sameMediaSource(saved.source, source)) {
        nextStarts[row.key] = saved.start
        nextEnds[row.key] = saved.end
      }
    }
    if (nextStarts[myKey] == null && initialStart != null) nextStarts[myKey] = initialStart
    setStarts(nextStarts)
    setEnds(nextEnds)
    setPlacedRows(initialSegments?.length ? initialSegments.map(rowOf) : null)
    setSuggestionNotes(null)
    setNote(null)
    setError(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sourceId, speechName])

  useEffect(() => {
    if (styleIndexProp != null) {
      setStyleIndex(styleIndexProp)
      setPlacedRows(null)
    }
  }, [styleIndexProp])

  // "Play clip" stops at the stop point.
  useEffect(() => {
    const stopAt = clipEndRef.current
    if (stopAt != null && player.currentTime >= stopAt) {
      player.pause()
      clipEndRef.current = null
    }
  }, [player])

  // Fixed per video; seeking goes over postMessage so the player isn't reloaded.
  const embedSrc = useMemo(
    () => {
      if (source.kind !== "youtube") return null
      // Open at the saved or given start; state isn't set yet on the first render.
      const saved = loadSpeechMediaClip(speechName)
      const opening = saved && sameMediaSource(saved.source, source) ? saved.start : initialStart
      return buildEmbedUrl(source.videoId, { startSeconds: opening ?? 0 })
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sourceId],
  )

  const clipFor = (s: number, e: number) => ({ source, title, start: Math.round(s), end: Math.round(e) })

  /** Every labelled speech, its stop defaulting to the next start or its rule length. */
  const labelledSegments = (): SpeechSegment[] =>
    rows.flatMap((row, i) => {
      const s = starts[row.key]
      if (s == null) return []
      const next = rows.slice(i + 1).find((later) => starts[later.key] != null)
      const e = ends[row.key] ?? (next ? starts[next.key] : s + (row.expectedSeconds || 60 * 60))
      return [{ ...row, start: s, end: e }]
    })

  const suggest = async () => {
    setSuggesting(true)
    setError(null)
    try {
      const captions = loadCaptions
        ? await loadCaptions()
        : source.kind === "youtube"
          ? await fetchCaptions(source.videoId)
          : { snippets: [], unavailable: "This audio has no captions" }
      const suggestion: SpeechTimestampSuggestion = await suggestSpeechTimestamps({
        ...captions,
        formatName: debateStyleNames[styleIndex] ?? styleKey,
        speeches,
        prepMinutes: format?.prepTime ?? 0,
        firstStart: start,
      })
      setPlacedRows(suggestion.segments.map(rowOf))
      setStarts(Object.fromEntries(suggestion.segments.map((segment) => [segment.key, Math.round(segment.start)])))
      setEnds(Object.fromEntries(suggestion.segments.map((segment) => [segment.key, Math.round(segment.end)])))
      setSuggestionNotes(suggestion.notes || null)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setSuggesting(false)
    }
  }

  const save = () => {
    if (start == null) return
    saveSpeechMediaClip(myKey, clipFor(start, end ?? start + 60 * 60))
    setNote(`Saved for ${speechName}.`)
  }

  const labelledCount = rows.filter((row) => starts[row.key] != null).length

  const saveAll = () => {
    const segments = labelledSegments()
    if (!segments.length) return
    for (const segment of segments) saveSpeechMediaClip(segment.key, clipFor(segment.start, segment.end))
    if (source.kind === "youtube") syncWatchPageMarks(source.videoId, styleIndex, segments)
    onSaveAll?.(segments)
    setNote(`Saved ${segments.length} speeches.`)
  }

  const playClip = () => {
    if (start == null) return
    clipEndRef.current = end
    player.seek(start)
    player.play()
  }

  return (
    <div className="space-y-3">
      {source.kind === "youtube" ? (
        <div className="aspect-video w-full overflow-hidden rounded bg-black">
          <iframe
            ref={iframeRef}
            id="youtube-speech-preview"
            src={embedSrc ?? undefined}
            title={title || "YouTube preview"}
            className="h-full w-full"
            allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
            referrerPolicy="strict-origin-when-cross-origin"
            onLoad={() => startListening(iframeRef.current)}
          />
        </div>
      ) : (
        <audio ref={audioRef} src={source.url} controls preload="metadata" className="w-full" aria-label={title || "Audio"} />
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}
      {note && <p className="text-sm text-emerald-600 dark:text-emerald-400">{note}</p>}

      <div className="flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-1 text-xs">
          <span className="text-muted-foreground">Format</span>
          <select
            className="h-8 rounded-md border bg-background px-2 text-sm"
            value={styleIndex}
            onChange={(e) => {
              setStyleIndex(Number(e.target.value))
              setPlacedRows(null)
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
        <Button type="button" variant="outline" size="sm" className="h-8" onClick={playClip} disabled={start == null}>
          {player.playing ? <Pause className="h-4 w-4 mr-1" /> : <Play className="h-4 w-4 mr-1" />}
          Play clip
        </Button>
        <Button type="button" size="sm" className="h-8" onClick={save} disabled={start == null}>
          Save for {speechName}
        </Button>
        <Button type="button" variant="outline" size="sm" className="h-8" onClick={saveAll} disabled={labelledCount === 0}>
          Save all {labelledCount}
        </Button>
      </div>

      <section className="space-y-2 rounded border p-2">
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" size="sm" className="h-8" onClick={() => void suggest()} disabled={suggesting}>
            {suggesting ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Sparkles className="h-4 w-4 mr-1" />}
            Suggest all speeches with AI
          </Button>
          <p className="min-w-0 flex-1 text-[11px] text-muted-foreground">
            Reads the captions for where words are spoken and where there's silence, then fits the {speeches.length}{" "}
            speeches (with cross-ex and prep time) to the format's speech lengths.
            {start != null ? " Starts from your start point." : ""}
          </p>
        </div>
        {suggesting && (
          <p className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" /> Reading captions and placing speeches…
          </p>
        )}
        {suggestionNotes && <p className="text-xs text-muted-foreground">{suggestionNotes}</p>}
        <SpeechStartsEditor
          items={rows.map((row) => ({ key: row.key, label: row.key }))}
          starts={starts}
          onChange={(key, seconds) => setStarts((prev) => withTime(prev, key, seconds))}
          ends={ends}
          onEndChange={(key, seconds) => setEnds((prev) => withTime(prev, key, seconds))}
          durationSeconds={player.duration}
          currentTime={player.currentTime}
          onSeek={player.seek}
          highlightKey={myKey}
          className="max-h-80"
        />
      </section>
    </div>
  )
}
