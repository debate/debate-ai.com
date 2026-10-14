/**
 * @fileoverview The full transcript of a recorded speech in a centred modal,
 * opened from the captions ticker's expand button. Every word is clickable
 * and seeks the recording there, the word being played is highlighted and
 * kept in view, and "Split into sections" asks the AI to break the speech
 * into titled sections (`recorder/transcript-sections.ts`), each heading
 * also seeking the audio. Must render inside the recording's
 * `AudioPlayerProvider` (React context crosses the dialog's portal).
 */

"use client"

import { Fragment, useEffect, useRef, useState } from "react"
import { Dialog as DialogPrimitive } from "radix-ui"
import { Loader2, Sparkles, X } from "lucide-react"
import { cn } from "../ui/lib/utils"
import { Button } from "../ui/primitives/button"
import type { CaptionWord } from "./speech-captions"
import { useActiveCaptionIndex, useCaptionSeek } from "./caption-hooks"
import {
    formatClock,
    loadTranscriptSections,
    requestTranscriptSections,
    saveTranscriptSections,
    type TranscriptSection,
} from "./transcript-sections"

export interface SpeechTranscriptDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    speechName: string
    track: { id: string; src: string }
    words: readonly CaptionWord[]
    /** Changes whenever the transcript does, so cached AI sections are dropped. */
    transcriptVersion: string
}

export function SpeechTranscriptDialog({
    open,
    onOpenChange,
    speechName,
    track,
    words,
    transcriptVersion,
}: SpeechTranscriptDialogProps) {
    const active = useActiveCaptionIndex(words, track)
    const seekTo = useCaptionSeek(track)

    const [sections, setSections] = useState<TranscriptSection[] | null>(null)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        if (!open) return
        setSections(loadTranscriptSections(speechName, transcriptVersion))
        setError(null)
    }, [open, speechName, transcriptVersion])

    const splitIntoSections = async () => {
        setLoading(true)
        setError(null)
        try {
            const next = await requestTranscriptSections(speechName, words)
            setSections(next)
            saveTranscriptSections(speechName, transcriptVersion, next)
        } catch (e) {
            setError(e instanceof Error ? e.message : "Couldn't split the transcript.")
        } finally {
            setLoading(false)
        }
    }

    // Keep the word being played in view while the modal is open.
    const wordRefs = useRef<(HTMLButtonElement | null)[]>([])
    useEffect(() => {
        if (!open) return
        wordRefs.current[active]?.scrollIntoView({ block: "nearest", behavior: "smooth" })
    }, [active, open])

    const sectionAt = new Map((sections ?? []).map((s) => [s.wordIndex, s]))

    return (
        <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
            <DialogPrimitive.Portal>
                <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/50" />
                <DialogPrimitive.Content
                    className="fixed left-1/2 top-1/2 z-50 flex max-h-[85vh] w-[calc(100vw-2rem)] max-w-2xl -translate-x-1/2 -translate-y-1/2 flex-col gap-3 rounded-lg border bg-background p-4 shadow-lg"
                >
                    <div className="flex items-center gap-2">
                        <DialogPrimitive.Title className="flex-1 text-base font-semibold">
                            {speechName} transcript
                        </DialogPrimitive.Title>
                        <Button
                            variant="outline"
                            size="sm"
                            className="h-7 gap-1.5 px-2 text-xs"
                            onClick={splitIntoSections}
                            disabled={loading || words.length === 0}
                            title="Use AI to split the transcript into titled sections"
                        >
                            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                            {sections ? "Re-split sections" : "Split into sections"}
                        </Button>
                        <DialogPrimitive.Close asChild>
                            <Button variant="ghost" size="icon" className="h-7 w-7" aria-label="Close">
                                <X className="h-4 w-4" />
                            </Button>
                        </DialogPrimitive.Close>
                    </div>
                    <DialogPrimitive.Description className="text-xs text-muted-foreground">
                        Click any word or section to jump the recording there.
                    </DialogPrimitive.Description>

                    {sections && sections.length > 1 && (
                        <nav aria-label="Sections" className="flex flex-wrap gap-1">
                            {sections.map((s) => (
                                <button
                                    key={s.wordIndex}
                                    type="button"
                                    onClick={() => {
                                        seekTo(s.start)
                                        wordRefs.current[s.wordIndex]?.scrollIntoView({ block: "start", behavior: "smooth" })
                                    }}
                                    className="rounded-full border px-2 py-0.5 text-xs hover:bg-muted"
                                >
                                    {s.title}
                                </button>
                            ))}
                        </nav>
                    )}

                    {error && <p className="text-xs text-destructive">{error}</p>}

                    <div className="min-h-0 flex-1 overflow-y-auto rounded-md bg-muted/40 p-3 text-sm leading-relaxed">
                        {words.length === 0 ? (
                            <p className="text-muted-foreground">
                                No transcript yet — it's transcribed while a speech is recorded.
                            </p>
                        ) : (
                            words.map((w, i) => {
                                const section = sectionAt.get(i)
                                return (
                                    <Fragment key={i}>
                                        {section && (
                                            <button
                                                type="button"
                                                onClick={() => seekTo(section.start)}
                                                className={cn(
                                                    "flex w-full items-baseline gap-2 text-left font-semibold hover:underline",
                                                    i > 0 ? "mt-3 mb-1" : "mb-1",
                                                )}
                                            >
                                                <span>{section.title}</span>
                                                <span className="text-xs font-normal tabular-nums text-muted-foreground">
                                                    {formatClock(section.start)}
                                                </span>
                                            </button>
                                        )}
                                        <button
                                            ref={(el) => {
                                                wordRefs.current[i] = el
                                            }}
                                            type="button"
                                            onClick={() => seekTo(w.start)}
                                            title={`Jump to ${formatClock(w.start)}`}
                                            aria-current={i === active ? "true" : undefined}
                                            className={cn(
                                                "mr-1 rounded px-0.5 transition-colors hover:bg-primary/15",
                                                i === active && "bg-yellow-300 font-semibold text-black",
                                                i < active && "text-muted-foreground",
                                            )}
                                        >
                                            {w.word}
                                        </button>
                                    </Fragment>
                                )
                            })
                        )}
                    </div>
                </DialogPrimitive.Content>
            </DialogPrimitive.Portal>
        </DialogPrimitive.Root>
    )
}
