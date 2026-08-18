"use client"

/**
 * @fileoverview Speech Word Counter
 *
 * The word-limited counterpart to `SpeechTimer`: instead of counting a speech
 * down in milliseconds, it counts the words typed for that speech up against a
 * limit. Used by the flow page's speech header bar when word-limit mode is on,
 * so a practice or asynchronous round can be bounded by words rather than time.
 *
 * Word counting and limit status come from `formats/word-count-format`; this
 * component adds no counting logic of its own.
 *
 * @module timers/SpeechWordCounter
 */

import { useState } from "react"
import { Type } from "lucide-react"
import { Button } from "debate-ui/src/primitives/button"
import { Textarea } from "debate-ui/src/primitives/textarea"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "debate-ui/src/primitives/popover"
import { cn } from "debate-ui/src/lib/utils"
import { getWordCountStatus } from "../formats/word-count-format"

/** Fraction of the limit at which the readout starts warning. */
const WARNING_RATIO = 0.9

interface SpeechWordCounterProps {
  /** Speech/column name the text belongs to, e.g. `"AC"` or `"1AR"`. */
  speechName: string
  /** Maximum words allowed for this speech. */
  wordLimit: number
  /** Text typed so far for this speech. */
  text: string
  /** Called with the new text as the speaker types. */
  onTextChange: (text: string) => void
  /** Uses a tighter layout for use inside the speech header bar. */
  compact?: boolean
  className?: string
}

/**
 * Renders a live `words / limit` readout for one speech, with the speech text
 * editable in a popover so the meter can sit in the compact header bar where
 * the countdown normally is.
 */
export function SpeechWordCounter({
  speechName,
  wordLimit,
  text,
  onTextChange,
  compact = false,
  className,
}: SpeechWordCounterProps) {
  const [open, setOpen] = useState(false)
  const status = getWordCountStatus(text, wordLimit)
  const isWarning = !status.overLimit && status.percentUsed >= WARNING_RATIO

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          className={cn(
            "flex items-center gap-1.5 font-bold tabular-nums",
            compact ? "h-7 px-2 text-sm" : "h-9 px-3 text-lg",
            status.overLimit && "text-[var(--text-error)]",
            isWarning && "text-yellow-600 dark:text-yellow-400",
            className,
          )}
          title={`${speechName} word limit`}
          aria-label={`${speechName} word count: ${status.count} of ${wordLimit} words`}
        >
          <Type className={cn(compact ? "h-3.5 w-3.5" : "h-4 w-4")} />
          <span>
            {status.count}/{wordLimit}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 space-y-2" align="end">
        <div className="flex items-center justify-between gap-2 text-sm">
          <span className="font-semibold text-foreground">{speechName}</span>
          <span
            className={cn(
              "tabular-nums text-muted-foreground",
              status.overLimit && "text-[var(--text-error)]",
            )}
          >
            {status.overLimit
              ? `${Math.abs(status.remaining)} over`
              : `${status.remaining} left`}
          </span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div
            className={cn(
              "h-full rounded-full transition-[width]",
              status.overLimit ? "bg-[var(--text-error)]" : "bg-primary",
            )}
            style={{ width: `${Math.round(status.percentUsed * 100)}%` }}
          />
        </div>
        <Textarea
          value={text}
          onChange={(e) => onTextChange(e.target.value)}
          placeholder={`Type the ${speechName} speech…`}
          className="min-h-40"
        />
      </PopoverContent>
    </Popover>
  )
}
