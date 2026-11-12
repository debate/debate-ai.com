/**
 * @fileoverview The stand-in for a round video's description before its
 * decision is revealed.
 *
 * Uploaders often write the result into the YouTube description ("Harker
 * wins on a 2-1"), so wherever a round with a recorded decision would show
 * its description, this placeholder shows instead until "Reveal decision"
 * is clicked. Clicking the placeholder reveals the decision too, since it
 * uses the same per-video flag (`useDecisionReveal`).
 *
 * @module components/videos/card/HiddenDescription
 */

import { cn } from "../../../ui/lib/utils"

/** The placeholder's wording, shared so every surface reads the same. */
export const HIDDEN_DESCRIPTION_TEXT = "Description hidden until the decision is revealed. Click to reveal."

/**
 * Whether a video's description must wait for its decision reveal: only a
 * round that has a decision to reveal, and only until it is revealed.
 */
export function isDescriptionHidden(hasDecision: boolean, decisionRevealed: boolean): boolean {
  return hasDecision && !decisionRevealed
}

/** A muted, clickable line that reveals the decision (and the description). */
export function HiddenDescription({
  onReveal,
  className,
}: {
  onReveal: () => void
  className?: string
}) {
  return (
    <button
      type="button"
      onClick={(event) => {
        event.preventDefault()
        event.stopPropagation()
        onReveal()
      }}
      className={cn("text-left italic text-muted-foreground hover:text-foreground", className)}
    >
      {HIDDEN_DESCRIPTION_TEXT}
    </button>
  )
}
