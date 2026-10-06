/**
 * @fileoverview A scrolling captions strip for a speech recording — the
 * transcribed words run past like a stock ticker, the word being spoken is
 * highlighted and kept centred, and clicking any word seeks the audio there
 * (like clicking a line in YouTube's transcript). Must render inside the
 * recording's `AudioPlayerProvider`.
 *
 * Word times come from `recorder/speech-captions.ts`.
 */

"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { cn } from "../ui/lib/utils"
import { useAudioPlayer, useAudioPlayerTime } from "./audio-player"
import { activeCaptionIndex, buildCaptionWords } from "./speech-captions"
import { loadSpokenTranscript, SPOKEN_WORDS_EVENT, type SpokenTranscript } from "./spoken-words-store"

export interface SpeechCaptionsTickerProps {
    /** Speech whose transcript to show, e.g. "1AC". */
    speechName: string
    /** The recording's track, so clicking a word can start it playing. */
    track: { id: string; src: string }
    /** Recording length, used to time transcripts saved without segment timings. */
    durationSeconds?: number
    className?: string
}

export function SpeechCaptionsTicker({ speechName, track, durationSeconds, className }: SpeechCaptionsTickerProps) {
    const player = useAudioPlayer()
    const time = useAudioPlayerTime()
    const [transcript, setTranscript] = useState<SpokenTranscript | null>(null)

    useEffect(() => {
        setTranscript(loadSpokenTranscript(speechName))
        const onUpdate = (e: Event) => {
            const detail = (e as CustomEvent<{ speechName: string }>).detail
            if (detail?.speechName === speechName) setTranscript(loadSpokenTranscript(speechName))
        }
        window.addEventListener(SPOKEN_WORDS_EVENT, onUpdate)
        return () => window.removeEventListener(SPOKEN_WORDS_EVENT, onUpdate)
    }, [speechName])

    const words = useMemo(
        () => buildCaptionWords(transcript, durationSeconds ?? player.duration),
        [transcript, durationSeconds, player.duration],
    )
    const active = player.isItemActive(track.id) ? activeCaptionIndex(words, time) : -1

    // Keep the spoken word centred, ticker-style.
    const stripRef = useRef<HTMLDivElement>(null)
    const wordRefs = useRef<(HTMLButtonElement | null)[]>([])
    useEffect(() => {
        const strip = stripRef.current
        const el = wordRefs.current[active]
        if (!strip || !el) return
        const left = el.offsetLeft - strip.clientWidth / 2 + el.offsetWidth / 2
        strip.scrollTo({ left: Math.max(0, left), behavior: "smooth" })
    }, [active])

    const seekTo = (start: number) => {
        if (!player.isItemActive(track.id)) {
            void player.play(track).then(() => player.seek(start))
            return
        }
        player.seek(start)
        if (!player.isPlaying) void player.play()
    }

    if (words.length === 0) {
        return (
            <div className={cn("px-2.5 py-1.5 text-[11px] text-muted-foreground", className)}>
                No captions yet — they're transcribed while a speech is recorded.
            </div>
        )
    }

    return (
        <div
            ref={stripRef}
            role="list"
            aria-label={`${speechName} captions`}
            className={cn(
                "relative overflow-x-auto whitespace-nowrap rounded-md bg-black/85 px-2 py-1.5 text-sm leading-snug text-white",
                "[scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
                "[mask-image:linear-gradient(to_right,transparent,black_12%,black_88%,transparent)]",
                className,
            )}
        >
            {words.map((w, i) => (
                <button
                    key={i}
                    ref={(el) => {
                        wordRefs.current[i] = el
                    }}
                    type="button"
                    role="listitem"
                    onClick={() => seekTo(w.start)}
                    title={`Jump to ${Math.floor(w.start / 60)}:${Math.floor(w.start % 60).toString().padStart(2, "0")}`}
                    aria-current={i === active ? "true" : undefined}
                    className={cn(
                        "mr-1 rounded px-0.5 transition-colors hover:bg-white/20",
                        i === active ? "bg-yellow-300 font-semibold text-black" : i < active ? "text-white/60" : "text-white",
                    )}
                >
                    {w.word}
                </button>
            ))}
        </div>
    )
}
