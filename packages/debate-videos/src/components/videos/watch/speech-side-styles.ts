/**
 * @fileoverview Colours for a speech's side, shared by the per-speech tabs and
 * the timeline under the player so the 1AC is the same blue in both.
 *
 * Aff blue and neg red match the team badges under the video title. The
 * "solid" (selected or winning) state is mostly white with a faint tint and a
 * coloured ring rather than a filled block, like the team badges; cross-ex
 * is grey because nobody "gives" it; an overview or decision is neutral.
 * @module components/watch/speech-side-styles
 */

import type { SpeechSide } from "../../../lib/round-speeches"

export const SPEECH_SIDE_STYLES: Record<
  SpeechSide,
  { name: string; dot: string; soft: string; solid: string }
> = {
  aff: {
    name: "Affirmative",
    dot: "bg-blue-500",
    soft: "bg-blue-500/10 text-blue-700 dark:text-blue-300",
    solid: "bg-blue-50 text-blue-900 ring-1 ring-inset ring-blue-500 dark:bg-blue-50/85 dark:text-blue-950",
  },
  neg: {
    name: "Negative",
    dot: "bg-red-500",
    soft: "bg-red-500/10 text-red-700 dark:text-red-300",
    solid: "bg-red-50 text-red-900 ring-1 ring-inset ring-red-500 dark:bg-red-50/85 dark:text-red-950",
  },
  cx: {
    name: "Cross-examination",
    dot: "bg-muted-foreground",
    soft: "bg-muted-foreground/10 text-muted-foreground",
    solid: "bg-muted-foreground text-background",
  },
  neutral: {
    name: "Round",
    dot: "bg-foreground/40",
    soft: "bg-muted text-foreground",
    solid: "bg-foreground text-background",
  },
}
