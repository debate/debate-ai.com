/**
 * @fileoverview A modal for labelling where each speech of a round begins in
 * one long piece of media — the joined round MP3 (`RoundRecordingDialog`)
 * or a YouTube video of a round (`@debate/videos`' watch page). The media
 * stays with the caller: the dialog only needs the playhead, a way to seek,
 * and the length, so the same modal works for an `<audio>` element and a
 * YouTube iframe alike.
 *
 * Each speech gets a row: type its start (`m:ss`), set it to the playhead,
 * nudge it five seconds either way, jump to it, or clear it. The bar on top
 * shows every start as a tick against the playhead; clicking it seeks.
 *
 * @module recorder/SpeechStartsDialog
 */

"use client"

import { useEffect, useState, type ReactNode } from "react"
import { Dialog as DialogPrimitive } from "radix-ui"
import { Crosshair, Play, X } from "lucide-react"
import { Button } from "../ui/primitives/button"
import { cn } from "../ui/lib/utils"
import { formatClock, parseClock, type SpeechStartItem, type SpeechStarts } from "./round-recording"

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

const NUDGE_SECONDS = 5

function StartInput({ value, onCommit }: { value: number | undefined; onCommit: (seconds: number | null) => void }) {
    const [text, setText] = useState(value === undefined ? "" : formatClock(value))
    useEffect(() => setText(value === undefined ? "" : formatClock(value)), [value])
    const commit = () => {
        if (!text.trim()) return onCommit(null)
        const seconds = parseClock(text)
        if (seconds === null) setText(value === undefined ? "" : formatClock(value))
        else onCommit(seconds)
    }
    return (
        <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => { if (e.key === "Enter") commit() }}
            placeholder="m:ss"
            inputMode="numeric"
            aria-label="Start time"
            className="h-7 w-16 rounded border bg-background px-1.5 text-center text-xs tabular-nums"
        />
    )
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
    const clamp = (seconds: number) => Math.max(0, durationSeconds > 0 ? Math.min(seconds, durationSeconds) : seconds)
    const percent = (seconds: number) => (durationSeconds > 0 ? `${(clamp(seconds) / durationSeconds) * 100}%` : "0%")

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

                    <button
                        type="button"
                        className="relative h-6 w-full rounded bg-muted"
                        aria-label="Seek"
                        onClick={(e) => {
                            if (durationSeconds <= 0) return
                            const rect = e.currentTarget.getBoundingClientRect()
                            onSeek(((e.clientX - rect.left) / rect.width) * durationSeconds)
                        }}
                    >
                        {items.map((item) =>
                            starts[item.key] === undefined ? null : (
                                <span
                                    key={item.key}
                                    className="absolute top-0 h-full w-px bg-primary"
                                    style={{ left: percent(starts[item.key]) }}
                                    title={`${item.label} · ${formatClock(starts[item.key])}`}
                                >
                                    <span className="absolute left-0.5 top-0 whitespace-nowrap text-[9px] leading-none text-muted-foreground">
                                        {item.label}
                                    </span>
                                </span>
                            ),
                        )}
                        <span className="absolute top-0 h-full w-0.5 bg-red-500" style={{ left: percent(currentTime) }} />
                    </button>
                    <div className="text-right text-[11px] tabular-nums text-muted-foreground">
                        {formatClock(currentTime)} / {formatClock(durationSeconds)}
                    </div>

                    <ol className="flex min-h-0 flex-col gap-1 overflow-y-auto">
                        {items.map((item) => {
                            const start = starts[item.key]
                            const set = (seconds: number | null) => onChange(item.key, seconds === null ? null : clamp(seconds))
                            return (
                                <li key={item.key} className="flex items-center gap-1.5 rounded-md bg-muted/50 px-2 py-1 text-xs">
                                    <span className="min-w-0 flex-1 truncate font-medium">{item.label}</span>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-7 px-1.5 text-[11px]"
                                        disabled={start === undefined}
                                        onClick={() => start !== undefined && set(start - NUDGE_SECONDS)}
                                        aria-label={`${item.label} ${NUDGE_SECONDS} seconds earlier`}
                                    >
                                        −{NUDGE_SECONDS}s
                                    </Button>
                                    <StartInput value={start} onCommit={set} />
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-7 px-1.5 text-[11px]"
                                        disabled={start === undefined}
                                        onClick={() => start !== undefined && set(start + NUDGE_SECONDS)}
                                        aria-label={`${item.label} ${NUDGE_SECONDS} seconds later`}
                                    >
                                        +{NUDGE_SECONDS}s
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-7 w-7"
                                        onClick={() => set(currentTime)}
                                        title="Starts here (the playhead)"
                                        aria-label={`${item.label} starts at the playhead`}
                                    >
                                        <Crosshair className="h-3.5 w-3.5" />
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-7 w-7"
                                        disabled={start === undefined}
                                        onClick={() => start !== undefined && onSeek(start)}
                                        title="Play from here"
                                        aria-label={`Play ${item.label}`}
                                    >
                                        <Play className="h-3.5 w-3.5" />
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className={cn("h-7 w-7", start === undefined && "invisible")}
                                        onClick={() => set(null)}
                                        title="Clear"
                                        aria-label={`Clear ${item.label} start`}
                                    >
                                        <X className="h-3.5 w-3.5" />
                                    </Button>
                                </li>
                            )
                        })}
                    </ol>
                </DialogPrimitive.Content>
            </DialogPrimitive.Portal>
        </DialogPrimitive.Root>
    )
}
