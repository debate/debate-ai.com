/**
 * @fileoverview The one editor for where each speech of a round starts (and,
 * optionally, stops) in a long piece of media. Every speech-labelling surface
 * renders it: {@link SpeechStartsDialog} (the joined round MP3 and the video
 * watch page) and `debate-round`'s `SpeechStartLabeler` (YouTube or MP3, with
 * AI suggestions). The media stays with the caller: the editor only needs the
 * playhead, a way to seek, and the length.
 *
 * Each speech gets a row: type its start (`m:ss`), set it to the playhead,
 * nudge it five seconds either way, jump to it, or clear it — and the same
 * for its stop when `onEndChange` is given. The bar on top shows every start
 * as a tick against the playhead; clicking it seeks.
 *
 * @module recorder/SpeechStartsEditor
 */

"use client"

import { useEffect, useState } from "react"
import { Crosshair, Play, X } from "lucide-react"
import { Button } from "../ui/primitives/button"
import { cn } from "../ui/lib/utils"
import { formatClock, parseClock, type SpeechStartItem, type SpeechStarts } from "./round-recording"

export interface SpeechStartsEditorProps {
    /** The round's speeches, in order. */
    items: SpeechStartItem[]
    /** Where each speech starts now; a missing key is unlabelled. */
    starts: SpeechStarts
    /** Set (`seconds`) or clear (`null`) one speech's start. */
    onChange: (speechKey: string, seconds: number | null) => void
    /** Where each speech stops; only shown when `onEndChange` is given. */
    ends?: SpeechStarts
    /** Set or clear one speech's stop. Omit to edit starts only. */
    onEndChange?: (speechKey: string, seconds: number | null) => void
    /** Length of the media in seconds; 0 while unknown. */
    durationSeconds: number
    /** The media's playhead, in seconds. */
    currentTime: number
    onSeek: (seconds: number) => void
    /** A speech to highlight, e.g. the one the timer is on. */
    highlightKey?: string
    className?: string
}

const NUDGE_SECONDS = 5

function TimeInput({
    value,
    label,
    onCommit,
}: {
    value: number | undefined
    label: string
    onCommit: (seconds: number | null) => void
}) {
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
            aria-label={label}
            className="h-7 w-16 rounded border bg-background px-1.5 text-center text-xs tabular-nums"
        />
    )
}

/** One time (start or stop) with its nudge, playhead and clear buttons. */
function TimeControls({
    what,
    itemLabel,
    value,
    currentTime,
    onSet,
}: {
    what: "start" | "stop"
    itemLabel: string
    value: number | undefined
    currentTime: number
    onSet: (seconds: number | null) => void
}) {
    const name = what === "start" ? "starts" : "stops"
    return (
        <div className="flex items-center gap-0.5">
            <Button
                variant="ghost"
                size="sm"
                className="h-7 px-1 text-[11px]"
                disabled={value === undefined}
                onClick={() => value !== undefined && onSet(value - NUDGE_SECONDS)}
                aria-label={`${itemLabel} ${what} ${NUDGE_SECONDS} seconds earlier`}
            >
                −{NUDGE_SECONDS}s
            </Button>
            <TimeInput value={value} label={what === "start" ? "Start time" : "Stop time"} onCommit={onSet} />
            <Button
                variant="ghost"
                size="sm"
                className="h-7 px-1 text-[11px]"
                disabled={value === undefined}
                onClick={() => value !== undefined && onSet(value + NUDGE_SECONDS)}
                aria-label={`${itemLabel} ${what} ${NUDGE_SECONDS} seconds later`}
            >
                +{NUDGE_SECONDS}s
            </Button>
            <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => onSet(currentTime)}
                title={`${what === "start" ? "Starts" : "Stops"} here (the playhead)`}
                aria-label={`${itemLabel} ${name} at the playhead`}
            >
                <Crosshair className="h-3.5 w-3.5" />
            </Button>
            <Button
                variant="ghost"
                size="icon"
                className={cn("h-7 w-7", value === undefined && "invisible")}
                onClick={() => onSet(null)}
                title="Clear"
                aria-label={`Clear ${itemLabel} ${what}`}
            >
                <X className="h-3.5 w-3.5" />
            </Button>
        </div>
    )
}

export function SpeechStartsEditor({
    items,
    starts,
    onChange,
    ends = {},
    onEndChange,
    durationSeconds,
    currentTime,
    onSeek,
    highlightKey,
    className,
}: SpeechStartsEditorProps) {
    const clamp = (seconds: number) => Math.max(0, durationSeconds > 0 ? Math.min(seconds, durationSeconds) : seconds)
    const percent = (seconds: number) => (durationSeconds > 0 ? `${(clamp(seconds) / durationSeconds) * 100}%` : "0%")

    return (
        <div className={cn("flex min-h-0 flex-col gap-2", className)}>
            <button
                type="button"
                className="relative h-6 w-full shrink-0 rounded bg-muted"
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
                {formatClock(currentTime)}
                {durationSeconds > 0 && ` / ${formatClock(durationSeconds)}`}
            </div>

            <ol aria-label="Speeches" className="flex min-h-0 flex-col gap-1 overflow-y-auto">
                {items.map((item) => {
                    const start = starts[item.key]
                    const end = ends[item.key]
                    const highlighted = highlightKey !== undefined && item.key.toUpperCase() === highlightKey.toUpperCase()
                    return (
                        <li
                            key={item.key}
                            className={cn(
                                "flex flex-wrap items-center gap-x-1.5 gap-y-0.5 rounded-md px-2 py-1 text-xs",
                                highlighted ? "bg-primary/10 font-medium" : "bg-muted/50",
                            )}
                        >
                            <span className="min-w-0 flex-1 truncate font-medium">{item.label}</span>
                            <TimeControls
                                what="start"
                                itemLabel={item.label}
                                value={start}
                                currentTime={currentTime}
                                onSet={(s) => onChange(item.key, s === null ? null : clamp(s))}
                            />
                            {onEndChange && (
                                <TimeControls
                                    what="stop"
                                    itemLabel={item.label}
                                    value={end}
                                    currentTime={currentTime}
                                    onSet={(s) => onEndChange(item.key, s === null ? null : clamp(s))}
                                />
                            )}
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
                            {start !== undefined && end !== undefined && end <= start && (
                                <span className="w-full text-[10px] text-destructive">Stops before it starts.</span>
                            )}
                        </li>
                    )
                })}
            </ol>
        </div>
    )
}
