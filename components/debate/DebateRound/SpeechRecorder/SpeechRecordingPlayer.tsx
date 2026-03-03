"use client"

/**
 * @fileoverview SpeechRecordingPlayer Component
 *
 * Displays a list of audio recordings stored in localStorage for the
 * currently selected speech. Recordings are stored by the SpeechTimer
 * mic recording feature and keyed as `debate-recording-{speechName}`.
 */

import { useEffect, useState } from "react"
import { Trash2 } from "lucide-react"
import {
    AudioPlayerButton,
    AudioPlayerProgress,
    AudioPlayerProvider,
    AudioPlayerSpeed,
    AudioPlayerTime,
    AudioPlayerDuration,
} from "./audio-player"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface StoredRecording {
    key: string
    speechName: string
    speechLabel: string
    recordedAt: string
    audio: string
    durationSeconds?: number
}

/** Format seconds as m:ss, e.g. 312.4 → "5:12" */
function formatDuration(s: number): string {
    const m = Math.floor(s / 60)
    const sec = Math.floor(s % 60)
    return `${m}:${sec.toString().padStart(2, "0")}`
}

interface SpeechRecordingPlayerProps {
    /** Name of the currently selected speech — used as localStorage key suffix */
    speechName: string
    /** Full display label (e.g. "1AC — johnsmith") */
    speechLabel?: string
    className?: string
}

/**
 * Load the single recording for a given speech from localStorage.
 * Key format: `debate-recording-{speechName}` (exact match).
 */
function loadRecordings(speechName: string): StoredRecording[] {
    const key = `debate-recording-${speechName}`
    const raw = localStorage.getItem(key)
    if (!raw) return []
    try {
        const parsed = JSON.parse(raw) as Omit<StoredRecording, "key">
        return [{ ...parsed, key, speechLabel: parsed.speechLabel ?? parsed.speechName }]
    } catch {
        return []
    }
}

export function SpeechRecordingPlayer({
    speechName,
    speechLabel,
    className,
}: SpeechRecordingPlayerProps) {
    const [recordings, setRecordings] = useState<StoredRecording[]>([])

    // Reload whenever the speech name changes
    useEffect(() => {
        setRecordings(loadRecordings(speechName))
    }, [speechName])

    // Track whether the timer is actively recording this speech right now
    const [isLiveRecording, setIsLiveRecording] = useState(false)

    useEffect(() => {
        const onStarted = (e: Event) => {
            const detail = (e as CustomEvent<{ speechName: string }>).detail
            if (detail.speechName === speechName) setIsLiveRecording(true)
        }
        const onSaved = () => {
            setIsLiveRecording(false)
            setRecordings(loadRecordings(speechName))
        }
        window.addEventListener("debate-recording-started", onStarted)
        window.addEventListener("debate-recording-saved", onSaved)
        return () => {
            window.removeEventListener("debate-recording-started", onStarted)
            window.removeEventListener("debate-recording-saved", onSaved)
        }
    }, [speechName])

    const handleDelete = (key: string) => {
        if (!window.confirm("Delete this recording? This cannot be undone.")) return
        localStorage.removeItem(key)
        setRecordings((prev) => prev.filter((r) => r.key !== key))
    }

    if (recordings.length === 0 && !isLiveRecording) return null

    return (
        <div className={cn("flex flex-col gap-1 w-full", className)}>
            {recordings.map((rec) => {
                const track = { id: rec.key, src: rec.audio }
                const label = rec.speechLabel || speechLabel || speechName
                return (
                    <AudioPlayerProvider key={rec.key} initialPlaybackRate={0.75}>
                        {/* Player row */}
                        <div className="flex items-center gap-1.5 rounded-md bg-muted/50 px-2 py-1.5 text-xs group">
                            <span
                                className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider truncate max-w-[80px]"
                                title={label}
                            >
                                {label}
                            </span>
                            {/* Play / Pause */}
                            <AudioPlayerButton
                                item={track}
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 flex-shrink-0"
                            />

                            {/* Scrubber + times */}
                            <div className="flex flex-1 items-center gap-1 min-w-0">
                                <div className="flex items-center gap-0.5 text-[9px] tabular-nums text-muted-foreground min-w-max">
                                    <AudioPlayerTime className="text-[9px] tabular-nums text-foreground" />
                                    <span>/</span>
                                    {rec.durationSeconds != null ? (
                                        <span>{formatDuration(rec.durationSeconds)}</span>
                                    ) : (
                                        <AudioPlayerDuration className="text-[9px] tabular-nums text-muted-foreground" />
                                    )}
                                </div>
                                <AudioPlayerProgress className="flex-1 h-3" />
                                <AudioPlayerSpeed
                                    variant="ghost"
                                    size="icon"
                                    className="h-5 w-5 flex-shrink-0"
                                    speeds={[0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1]}
                                />
                            </div>

                            {/* Delete */}
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-5 w-5 flex-shrink-0 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                                onClick={() => handleDelete(rec.key)}
                            >
                                <Trash2 className="h-3 w-3" />
                            </Button>
                        </div>
                    </AudioPlayerProvider>
                )
            })}
        </div>
    )
}
