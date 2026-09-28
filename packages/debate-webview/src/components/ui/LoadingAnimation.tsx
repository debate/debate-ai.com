"use client"

/**
 * @fileoverview The clip {@link LoadingOverlay} draws in the middle of the
 * screen while a page loads.
 *
 * Three things it has to get right:
 *
 * 1. **A different clip each time.** `grab-url/animations` ships seventeen
 *    loaders and one is drawn at random per mount, so a user who sits through
 *    a lot of transitions doesn't watch the same loop every time. Which one is
 *    {@link pickLoadingAnimation}; what colour it comes out is
 *    {@link renderLoadingAnimation}, which walks the same hue ramp as the orb
 *    so the two read as one family.
 * 2. **Nothing to wait for.** The clip is inline SVG built from constants in
 *    the client bundle — a couple of kilobytes, no request, so there is no
 *    cold-cache hole in the middle of the screen and no error state to fall
 *    back from. That is the point of the change: this replaced a ~1 MB video
 *    that the overlay, usually up for well under a second, routinely
 *    outlived.
 * 3. **No second React.** Same rule as {@link AnimatedLoader}: the clips are
 *    string-building functions drawn as markup here, not components out of a
 *    package that bundles its own React. See that file for what that cost
 *    last time.
 */

import { useEffect, useRef, useState } from "react"
import { cn } from "../../lib/ui/lib/utils"
import {
  pickLoadingAnimation,
  prefersReducedMotion,
  readAccentHue,
  renderLoadingAnimation,
} from "../../lib/ui/loading-animations"

export type LoadingAnimationSize = "sm" | "md" | "lg"

/**
 * Drawn size in pixels. The clips carry a `viewBox` of `0 0 100 100` and
 * `preserveAspectRatio`, so these only set the box; the art scales into it.
 */
const sizePx: Record<LoadingAnimationSize, number> = {
  sm: 64,
  md: 120,
  lg: 200,
}

interface LoadingAnimationProps {
  size?: LoadingAnimationSize
  className?: string
}

export function LoadingAnimation({ size = "lg", className }: LoadingAnimationProps) {
  const containerRef = useRef<HTMLDivElement>(null)

  // Rolled once per mount, and the overlay unmounts between transitions, so
  // every load draws a fresh clip. Held in state rather than recomputed on
  // render so a re-render (a label change mid-load) doesn't swap the clip out
  // from under the viewer.
  const [markup] = useState(() => {
    const animation = pickLoadingAnimation({ staticFrame: prefersReducedMotion() })
    return renderLoadingAnimation(animation, { size: sizePx[size], hue: readAccentHue() })
  })

  // The clips animate through SMIL (`<animate>`, `<animateTransform>`), which
  // no media query reaches — `prefers-reduced-motion` has to be honoured by
  // stopping the document's animation clock on the element itself. The draw
  // above has already excluded the clips whose first frame is blank, so what
  // this holds is always something to look at.
  useEffect(() => {
    if (!prefersReducedMotion()) return
    const svg = containerRef.current?.querySelector("svg")
    if (svg && typeof svg.pauseAnimations === "function") svg.pauseAnimations()
  }, [])

  return (
    <div
      ref={containerRef}
      // The label on the overlay already announces the loading state, and a
      // decorative loop has nothing to add to it.
      aria-hidden="true"
      className={cn(
        "flex items-center justify-center [&>svg]:h-auto [&>svg]:max-w-full",
        className,
      )}
      // Every byte is a constant out of `grab-url/animations` plus the hex
      // literals `renderLoadingAnimation` builds from a number. Nothing
      // user-supplied reaches this, and the clips carry no script.
      dangerouslySetInnerHTML={{ __html: markup }}
    />
  )
}
