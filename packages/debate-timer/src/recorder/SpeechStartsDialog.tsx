/**
 * @fileoverview A modal for labelling where each speech of a round begins in
 * one long piece of media — the joined round MP3 (`RoundRecordingDialog`)
 * or a YouTube video of a round (`@debate-ai/videos`' watch page). The media
 * stays with the caller: the dialog only needs the playhead, a way to seek,
 * and the length, so the same modal works for an `<audio>` element and a
 * YouTube iframe alike.
 *
 * The rows and the seek bar are {@link SpeechStartsEditor}, the same editor
 * `debate-round`'s `SpeechStartLabeler` uses for YouTube and MP3 clips; this
 * file is only the dialog around it.
 *
 * @module recorder/SpeechStartsDialog
 */

"use client"

import type { ReactNode } from "react"
import { Dialog as DialogPrimitive } from "radix-ui"
import { Loader2, Wand2, X } from "lucide-react"
import { Button } from "../ui/primitives/button"
import { cn } from "../ui/lib/utils"
import type { SpeechStartItem, SpeechStarts } from "./round-recording"
import { SpeechStartsEditor } from "./SpeechStartsEditor"

/**
 * The page's "Detect speeches" request, as the dialog shows it. The page owns
 * it because the result re-times the whole round, timeline included. Defined
 * here so both `debate-videos` (the watch page) and `debate-timer` (the
 * round recording dialog) share one shape.
 */
export interface SpeechDetectionControl {
    /** Starts (or re-runs) the detection. */
    onDetect: () => void
    /** Forgets the detected speeches; omitted while there are none. */
    onClear?: () => void
    running: boolean
    error?: string | null
    /** A one-line description of the last result — `Policy · 11 speeches found`. */
    result?: string | null
    /** False while the captions it reads are not loaded. */
    available: boolean
}

export interface SpeechStartsDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    /** Heading, e.g. "Speech start times". */
    title?: string
    /** The round's speeches, in order. */
    items: SpeechStartItem[]
    /** Where each speech starts now; a missing key is unlabelled. */
    starts: SpeechStarts
    /** Length of the media in seconds; 0 while unknown. */
    durationSeconds: number
    /** The media's playhead, in seconds. */
    currentTime: number
    onSeek: (seconds: number) => void
    /** Set (`seconds`) or clear (`null`) one speech's start. */
    onChange: (speechKey: string, seconds: number | null) => void
    /** Rendered above the list — a player, when the media isn't already on screen. */
    children?: ReactNode
    /**
     * False docks the dialog in the bottom corner with no backdrop, so media
     * already on the page (a YouTube player) stays visible and usable while
     * labelling. Default true.
     */
    modal?: boolean
    /** The AI "Detect speeches" control; without it the dialog offers no Detect control. */
    detection?: SpeechDetectionControl
}

export function SpeechStartsDialog({
    open,
    onOpenChange,
    title = "Speech start times",
    items,
    starts,
    durationSeconds,
    currentTime,
    onSeek,
    onChange,
    children,
    modal = true,
    detection,
}: SpeechStartsDialogProps) {
    return (
        <DialogPrimitive.Root open={open} onOpenChange={onOpenChange} modal={modal}>
            <DialogPrimitive.Portal>
                {modal && <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/50" />}
                <DialogPrimitive.Content
                    onInteractOutside={modal ? undefined : (e) => e.preventDefault()}
                    className={cn(
                        "fixed z-50 flex flex-col gap-3 rounded-lg border bg-background p-4 shadow-lg",
                        modal
                            ? "left-1/2 top-1/2 max-h-[85vh] w-[calc(100vw-2rem)] max-w-xl -translate-x-1/2 -translate-y-1/2"
                            : "bottom-4 right-4 max-h-[60vh] w-[calc(100vw-2rem)] max-w-md",
                    )}
                >
                    <div className="flex items-center gap-2">
                        <DialogPrimitive.Title className="flex-1 text-base font-semibold">{title}</DialogPrimitive.Title>
                        <DialogPrimitive.Close asChild>
                            <Button variant="ghost" size="icon" className="h-7 w-7" aria-label="Close">
                                <X className="h-4 w-4" />
                            </Button>
                        </DialogPrimitive.Close>
                    </div>
                    <DialogPrimitive.Description className="text-xs text-muted-foreground">
                        Play to where a speech begins and press the crosshair, or type the time.
                        {detection ? ", or let Detect speeches find them all" : ""} — the timeline, the playing marker and each speech&apos;s captions follow.
                    </DialogPrimitive.Description>

                    {children}

                    {detection && (
                        <div className="flex shrink-0 flex-wrap items-center gap-x-2 gap-y-1 text-[11px]">
                            <button
                                type="button"
                                aria-label={detection.running ? "Detecting speeches…" : detection.result ? "Detect again" : "Detect speeches"}
                                onClick={detection.onDetect}
                                disabled={detection.running || !detection.available}
                                className="inline-flex items-center gap-1 rounded-md border border-border px-1.5 py-0.5 font-medium hover:bg-accent transition-colors disabled:opacity-50 disabled:hover:bg-transparent"
                                title={
                                    detection.available
                                        ? "Read the whole transcript with AI to find the format and where every speech begins and ends"
                                        : "Waiting for the captions"
                                }
                            >
                                {detection.running ? (
                                    <Loader2 className="h-3 w-3 animate-spin motion-reduce:animate-none" />
                                ) : (
                                    <Wand2 className="h-3 w-3" />
                                )}
                                {detection.running ? "Detecting speeches…" : detection.result ? "Detect again" : "Detect speeches"}
                            </button>
                            {detection.result && !detection.running && (
                                <span className="text-muted-foreground">{detection.result}</span>
                            )}
                            {detection.onClear && !detection.running && (
                                <button
                                    type="button"
                                    aria-label="Clear detection"
                                    onClick={detection.onClear}
                                    className="text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
                                >
                                    Clear
                                </button>
                            )}
                            {detection.error && !detection.running && (
                                <span role="alert" className="text-destructive">
                                    {detection.error}
                                </span>
                            )}
                        </div>
                    )}

                    <SpeechStartsEditor
                        items={items}
                        starts={starts}
                        onChange={onChange}
                        durationSeconds={durationSeconds}
                        currentTime={currentTime}
                        onSeek={onSeek}
                    />
                </DialogPrimitive.Content>
            </DialogPrimitive.Portal>
        </DialogPrimitive.Root>
    )
}
