/**
 * @fileoverview A scrolling captions strip for a speech recording — the
 * transcribed words run past like a stock ticker, the word being spoken is
 * highlighted and kept centred, and clicking any word seeks the audio there
 * (like clicking a line in YouTube's transcript). The expand button opens
 * the full transcript in `SpeechTranscriptDialog`. Must render inside the
 * recording's `AudioPlayerProvider`.
 *
 * Word times come from `recorder/speech-captions.ts`.
 */

"use client"

import { useEffect, useRef, useState } from "react"
import { Maximize2 } from "lucide-react"
import { cn } from "../ui/lib/utils"
import { Button } from "../ui/primitives/button"
import { useActiveCaptionIndex, useCaptionSeek, useCaptionWords } from "./caption-hooks"
import { SpeechTranscriptDialog } from "./SpeechTranscriptDialog"

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
    const { transcript, words } = useCaptionWords(speechName, durationSeconds)
    const active = useActiveCaptionIndex(words, track)
    const seekTo = useCaptionSeek(track)
    const [expanded, setExpanded] = useState(false)

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

    if (words.length === 0) {
        return (
            <div className={cn("px-2.5 py-1.5 text-[11px] text-muted-foreground", className)}>
                No captions yet — they're transcribed while a speech is recorded.
            </div>
        )
    }

    return (
        <div className={cn("flex items-stretch gap-1", className)}>
            <div
                ref={stripRef}
                role="list"
                aria-label={`${speechName} captions`}
                className={cn(
                    "relative min-w-0 flex-1 overflow-x-auto whitespace-nowrap rounded-md bg-black/85 px-2 py-1.5 text-sm leading-snug text-white",
                    "[scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
                    "[mask-image:linear-gradient(to_right,transparent,black_5%,black_95%,transparent)]",
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
            <Button
                variant="ghost"
                size="icon"
                className="h-auto w-7 shrink-0"
                onClick={() => setExpanded(true)}
                title="Open full transcript"
                aria-label={`Open ${speechName} full transcript`}
            >
                <Maximize2 className="h-3.5 w-3.5" />
            </Button>
            <SpeechTranscriptDialog
                open={expanded}
                onOpenChange={setExpanded}
                speechName={speechName}
                track={track}
                words={words}
                transcriptVersion={`${transcript?.updatedAt ?? ""}:${transcript?.wordCount ?? 0}`}
            />
        </div>
    )
}
