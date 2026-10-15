/**
 * @fileoverview A modal for labelling where each speech of a round begins in
 * one long piece of media — the joined round MP3 (`RoundRecordingDialog`)
 * or a YouTube video of a round (`@debate/videos`' watch page). The media
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
import { X } from "lucide-react"
import { Button } from "../ui/primitives/button"
import { cn } from "../ui/lib/utils"
import type { SpeechStartItem, SpeechStarts } from "./round-recording"
import { SpeechStartsEditor } from "./SpeechStartsEditor"

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
                    </DialogPrimitive.Description>

                    {children}

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
