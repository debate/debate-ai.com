/**
 * @fileoverview "Join round recording": every recorded speech of a round
 * joined into one MP3 (`round-recording-audio.ts`), played back here with
 * its captions and each debater's webcam clip spliced in under the speech it
 * belongs to, with a modal to adjust where each speech begins
 * ({@link SpeechStartsDialog}) and an explicit save to the site's R2 storage.
 *
 * The joined MP3, captions and clips live in this browser (IndexedDB,
 * `media-store.ts`) until "Save to cloud" uploads them.
 *
 * @module recorder/RoundRecordingDialog
 */

"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Dialog as DialogPrimitive } from "radix-ui"
import { Captions, CloudUpload, Download, ListOrdered, Loader2, Merge, X } from "lucide-react"
import { Button } from "../ui/primitives/button"
import {
    adjustSpeechStart,
    effectiveStarts,
    formatClock,
    loadRoundRecordingManifest,
    saveRoundRecordingManifest,
    speechAtTime,
    type RoundRecordingManifest,
    type SpeechStartItem,
} from "./round-recording"
import { joinRoundRecording, recordedSpeeches, type JoinOptions, type JoinStage } from "./round-recording-audio"
import { uploadRoundRecording } from "./round-recording-cloud"
import {
    clipKey,
    getMedia,
    listClips,
    putMedia,
    roundAudioKey,
    roundCaptionsKey,
    VIDEO_CLIP_SAVED_EVENT,
    type StoredClip,
} from "./media-store"
import { SpeechStartsDialog } from "./SpeechStartsDialog"

export interface RoundRecordingDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    /** Identifies the round's saved recording (local and in R2). */
    roundId: string
    /** The round's speeches in order; key = the timer's speech name. */
    items: SpeechStartItem[]
}

const STAGE_LABEL: Record<JoinStage, string> = {
    loading: "Loading recordings",
    announcing: "Reading speech names (Kokoro)",
    mixing: "Joining speeches",
    encoding: "Encoding MP3",
    captioning: "Transcribing (Moonshine)",
}

/** One webcam clip kept in step with the joined audio. */
function SplicedClip({ clip, offset, playing }: { clip: StoredClip; offset: number; playing: boolean }) {
    const ref = useRef<HTMLVideoElement>(null)
    const [url, setUrl] = useState<string | null>(null)
    useEffect(() => {
        let revoked = false
        let objectUrl: string | null = null
        void getMedia<Blob>(clipKey(clip.id)).then((blob) => {
            if (!blob || revoked) return
            objectUrl = URL.createObjectURL(blob)
            setUrl(objectUrl)
        })
        return () => {
            revoked = true
            if (objectUrl) URL.revokeObjectURL(objectUrl)
        }
    }, [clip.id])
    useEffect(() => {
        const video = ref.current
        if (!video || !url) return
        // Re-sync only when drift is noticeable; constant seeking stutters.
        if (Math.abs(video.currentTime - offset) > 0.4) video.currentTime = Math.max(0, offset)
        if (playing && video.paused) void video.play().catch(() => {})
        if (!playing && !video.paused) video.pause()
    }, [offset, playing, url])
    return (
        <figure className="relative overflow-hidden rounded bg-black">
            {url && <video ref={ref} src={url} muted playsInline className="aspect-video w-full object-cover" />}
            <figcaption className="absolute bottom-0 left-0 bg-black/60 px-1 text-[10px] text-white">{clip.participant}</figcaption>
        </figure>
    )
}

export function RoundRecordingDialog({ open, onOpenChange, roundId, items }: RoundRecordingDialogProps) {
    const audioRef = useRef<HTMLAudioElement>(null)
    const [manifest, setManifest] = useState<RoundRecordingManifest | null>(null)
    const [audioUrl, setAudioUrl] = useState<string | null>(null)
    const [captionsUrl, setCaptionsUrl] = useState<string | null>(null)
    const [mp3, setMp3] = useState<Blob | null>(null)
    const [vtt, setVtt] = useState<string | null>(null)
    const [options, setOptions] = useState<JoinOptions>({ announcements: false, captions: true, moonshine: false })
    const [progress, setProgress] = useState<{ label: string; fraction: number } | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [notice, setNotice] = useState<string | null>(null)
    const [time, setTime] = useState(0)
    const [playing, setPlaying] = useState(false)
    const [startsOpen, setStartsOpen] = useState(false)
    const [clips, setClips] = useState<StoredClip[]>([])

    const recordedCount = useMemo(() => (open ? recordedSpeeches(items).length : 0), [open, items])

    useEffect(() => {
        if (!open) return
        setManifest(loadRoundRecordingManifest(roundId))
        setClips(listClips())
        const refreshClips = () => setClips(listClips())
        window.addEventListener(VIDEO_CLIP_SAVED_EVENT, refreshClips)
        let cancelled = false
        void Promise.all([getMedia<Blob>(roundAudioKey(roundId)), getMedia<string>(roundCaptionsKey(roundId))]).then(
            ([audio, captions]) => {
                if (cancelled) return
                setMp3(audio)
                setVtt(captions)
            },
        )
        return () => {
            cancelled = true
            window.removeEventListener(VIDEO_CLIP_SAVED_EVENT, refreshClips)
        }
    }, [open, roundId])

    useEffect(() => {
        if (!mp3) return setAudioUrl(null)
        const url = URL.createObjectURL(mp3)
        setAudioUrl(url)
        return () => URL.revokeObjectURL(url)
    }, [mp3])
    useEffect(() => {
        if (!vtt) return setCaptionsUrl(null)
        const url = URL.createObjectURL(new Blob([vtt], { type: "text/vtt" }))
        setCaptionsUrl(url)
        return () => URL.revokeObjectURL(url)
    }, [vtt])

    const starts = useMemo(() => (manifest ? effectiveStarts(manifest) : {}), [manifest])
    const currentSpeech = speechAtTime(starts, time)
    const speechClips = clips.filter((clip) => clip.speechKey === currentSpeech)
    const joinedItems = useMemo(
        () => manifest?.speeches.map(({ key, label }) => ({ key, label })) ?? [],
        [manifest],
    )

    const handleJoin = async () => {
        setError(null)
        setNotice(null)
        try {
            const result = await joinRoundRecording({
                roundId,
                items,
                options,
                previous: manifest,
                onProgress: (stage, fraction) => setProgress({ label: STAGE_LABEL[stage], fraction }),
            })
            await putMedia(roundAudioKey(roundId), result.mp3)
            await putMedia(roundCaptionsKey(roundId), result.vtt ?? "")
            saveRoundRecordingManifest(result.manifest)
            setManifest(result.manifest)
            setMp3(result.mp3)
            setVtt(result.vtt)
            setNotice(`Joined ${result.manifest.speeches.length} speeches · ${formatClock(result.manifest.durationSeconds)}`)
        } catch (e) {
            setError(e instanceof Error ? e.message : "Could not join the recordings.")
        } finally {
            setProgress(null)
        }
    }

    const handleUpload = async () => {
        if (!manifest || !mp3) return
        setError(null)
        setNotice(null)
        try {
            const saved = await uploadRoundRecording(manifest, mp3, vtt, (fraction) =>
                setProgress({ label: "Saving to cloud", fraction }),
            )
            saveRoundRecordingManifest(saved)
            setManifest(saved)
            setNotice("Saved to the cloud.")
        } catch (e) {
            setError(e instanceof Error ? e.message : "Could not save to the cloud.")
        } finally {
            setProgress(null)
        }
    }

    const handleStartChange = useCallback(
        (key: string, seconds: number | null) => {
            setManifest((prev) => {
                if (!prev) return prev
                const next = adjustSpeechStart(prev, key, seconds)
                saveRoundRecordingManifest(next)
                return next
            })
        },
        [],
    )

    const seek = (seconds: number) => {
        if (audioRef.current) audioRef.current.currentTime = seconds
        setTime(seconds)
    }

    const busy = progress !== null
    const toggle = (key: keyof JoinOptions) => setOptions((prev) => ({ ...prev, [key]: !prev[key] }))

    return (
        <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
            <DialogPrimitive.Portal>
                <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/50" />
                <DialogPrimitive.Content className="fixed left-1/2 top-1/2 z-50 flex max-h-[90vh] w-[calc(100vw-2rem)] max-w-2xl -translate-x-1/2 -translate-y-1/2 flex-col gap-3 overflow-y-auto rounded-lg border bg-background p-4 shadow-lg">
                    <div className="flex items-center gap-2">
                        <DialogPrimitive.Title className="flex-1 text-base font-semibold">Round recording</DialogPrimitive.Title>
                        <DialogPrimitive.Close asChild>
                            <Button variant="ghost" size="icon" className="h-7 w-7" aria-label="Close">
                                <X className="h-4 w-4" />
                            </Button>
                        </DialogPrimitive.Close>
                    </div>
                    <DialogPrimitive.Description className="text-xs text-muted-foreground">
                        {recordedCount} of {items.length} speeches recorded. Joining puts them in round order in one MP3.
                    </DialogPrimitive.Description>

                    <fieldset className="flex flex-col gap-1 text-xs" disabled={busy}>
                        <label className="flex items-center gap-2">
                            <input type="checkbox" checked={!!options.announcements} onChange={() => toggle("announcements")} />
                            Read each speech's name before it (Kokoro voice)
                        </label>
                        <label className="flex items-center gap-2">
                            <input type="checkbox" checked={!!options.captions} onChange={() => toggle("captions")} />
                            Captions from the live transcription
                        </label>
                        <label className="flex items-center gap-2">
                            <input type="checkbox" checked={!!options.moonshine} onChange={() => toggle("moonshine")} />
                            Transcribe captions with Moonshine on this device (slower, more accurate)
                        </label>
                    </fieldset>

                    <div className="flex flex-wrap gap-2">
                        <Button size="sm" className="gap-1.5" onClick={() => void handleJoin()} disabled={busy || recordedCount === 0}>
                            <Merge className="h-3.5 w-3.5" />
                            {manifest ? "Re-join speeches" : "Join speeches"}
                        </Button>
                        <Button
                            size="sm"
                            variant="outline"
                            className="gap-1.5"
                            onClick={() => setStartsOpen(true)}
                            disabled={!manifest || !audioUrl}
                        >
                            <ListOrdered className="h-3.5 w-3.5" />
                            Adjust speech starts
                        </Button>
                        <Button size="sm" variant="outline" className="gap-1.5" onClick={() => void handleUpload()} disabled={busy || !manifest || !mp3}>
                            <CloudUpload className="h-3.5 w-3.5" />
                            {manifest?.remote?.manifest ? "Save to cloud again" : "Save to cloud"}
                        </Button>
                        {audioUrl && (
                            <Button size="sm" variant="ghost" className="gap-1.5" asChild>
                                <a href={audioUrl} download={`round-${roundId}.mp3`}>
                                    <Download className="h-3.5 w-3.5" />
                                    MP3
                                </a>
                            </Button>
                        )}
                    </div>

                    {progress && (
                        <div className="flex items-center gap-2 text-xs text-muted-foreground" role="status">
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            {progress.label} · {Math.round(progress.fraction * 100)}%
                        </div>
                    )}
                    {error && <p className="text-xs text-red-600 dark:text-red-400" role="alert">{error}</p>}
                    {notice && !error && <p className="text-xs text-muted-foreground">{notice}</p>}

                    {audioUrl && (
                        <>
                            {speechClips.length > 0 && (
                                <div className="grid grid-cols-2 gap-1">
                                    {speechClips.map((clip) => (
                                        <SplicedClip
                                            key={clip.id}
                                            clip={clip}
                                            offset={time - (starts[clip.speechKey] ?? 0)}
                                            playing={playing}
                                        />
                                    ))}
                                </div>
                            )}
                            <audio
                                ref={audioRef}
                                src={audioUrl}
                                controls
                                className="w-full"
                                onTimeUpdate={(e) => setTime(e.currentTarget.currentTime)}
                                onPlay={() => setPlaying(true)}
                                onPause={() => setPlaying(false)}
                            >
                                {captionsUrl && <track kind="captions" src={captionsUrl} srcLang="en" label="Captions" default />}
                            </audio>
                            <ol className="flex flex-wrap gap-1 text-[11px]">
                                {joinedItems.map((item) => (
                                    <li key={item.key}>
                                        <button
                                            type="button"
                                            onClick={() => seek(starts[item.key] ?? 0)}
                                            className={
                                                "rounded border px-1.5 py-0.5 tabular-nums " +
                                                (item.key === currentSpeech ? "bg-primary text-primary-foreground" : "hover:bg-muted")
                                            }
                                        >
                                            {item.label} {formatClock(starts[item.key] ?? 0)}
                                        </button>
                                    </li>
                                ))}
                                {vtt && (
                                    <li className="flex items-center gap-1 text-muted-foreground">
                                        <Captions className="h-3 w-3" /> captions
                                    </li>
                                )}
                            </ol>
                        </>
                    )}

                    {manifest && (
                        <SpeechStartsDialog
                            open={startsOpen}
                            onOpenChange={setStartsOpen}
                            items={joinedItems}
                            starts={starts}
                            durationSeconds={manifest.durationSeconds}
                            currentTime={time}
                            onSeek={seek}
                            onChange={handleStartChange}
                        >
                            <div className="flex gap-2">
                                <Button size="sm" variant="outline" onClick={() => audioRef.current?.play()}>Play</Button>
                                <Button size="sm" variant="outline" onClick={() => audioRef.current?.pause()}>Pause</Button>
                            </div>
                        </SpeechStartsDialog>
                    )}
                </DialogPrimitive.Content>
            </DialogPrimitive.Portal>
        </DialogPrimitive.Root>
    )
}
