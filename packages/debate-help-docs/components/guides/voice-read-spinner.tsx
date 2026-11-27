/**
 * @file voice-read-spinner.tsx
 * @description The loading animation that follows the word the Voice reader is
 * saying (`voice-read-button.tsx`, `voice-read-ball.ts`). It replaces the old
 * plain dot with one of the grab.js Spinner variants
 * (https://grab.js.org/docs/loading-animations#react-spinner), picked at
 * random each time a reading starts and kept until it stops.
 *
 * It draws with `currentColor` (the docs theme's primary colour, so light and
 * dark both work), is a `role="status"` labelled "Reading aloud", and stands
 * still under `prefers-reduced-motion` (CSS animations in `styles/docs.css`,
 * SVG animations paused here).
 */
import { useEffect, useRef } from "react"
import { createRoot } from "react-dom/client"
import { Spinner } from "../ui/spinner"

/** The grab.js Spinner variants a reading can show (the plain spokes `default` is left out). */
export const VOICE_SPINNER_VARIANTS = ["circle", "pinwheel", "circle-filled", "ellipsis", "ring", "bars", "infinite"] as const

export type VoiceSpinnerVariant = (typeof VOICE_SPINNER_VARIANTS)[number]

/** Spinner side in px: about the size of the dot it replaces, a little larger so the motion reads. */
export const VOICE_SPINNER_SIZE = 18

/** A random variant; `random` (0 up to but not including 1, like `Math.random`) is injectable for tests. */
export function pickVoiceSpinnerVariant(random: () => number = Math.random): VoiceSpinnerVariant {
  const index = Math.floor(random() * VOICE_SPINNER_VARIANTS.length)
  return VOICE_SPINNER_VARIANTS[Math.min(VOICE_SPINNER_VARIANTS.length - 1, Math.max(0, index || 0))]!
}

/** True when the reader asked the system for less motion. */
function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches
}

/** The spinner under the word being read. */
export function VoiceSpinner({ variant, size = VOICE_SPINNER_SIZE }: { variant: VoiceSpinnerVariant; size?: number }) {
  const ref = useRef<HTMLSpanElement | null>(null)

  // SVG (SMIL) animations ignore the CSS reduced-motion rule, so freeze them.
  useEffect(() => {
    const query = typeof window !== "undefined" && typeof window.matchMedia === "function" ? window.matchMedia("(prefers-reduced-motion: reduce)") : null
    const apply = () => {
      const svg = ref.current?.querySelector("svg")
      if (!svg || typeof svg.pauseAnimations !== "function") return
      if (query?.matches ?? prefersReducedMotion()) svg.pauseAnimations()
      else svg.unpauseAnimations()
    }
    apply()
    query?.addEventListener?.("change", apply)
    return () => query?.removeEventListener?.("change", apply)
  }, [variant])

  return (
    <span
      ref={ref}
      role="status"
      aria-label="Reading aloud"
      data-voice-spinner={variant}
      className="voice-spinner"
    >
      <Spinner variant={variant} size={size} aria-hidden="true" focusable="false" />
    </span>
  )
}

/**
 * Renders the spinner into `host` (the ball's element, which lives outside
 * React) and returns the function that removes it.
 */
export function mountVoiceSpinner(host: HTMLElement, variant: VoiceSpinnerVariant, size: number = VOICE_SPINNER_SIZE): () => void {
  const root = createRoot(host)
  root.render(<VoiceSpinner variant={variant} size={size} />)
  return () => root.unmount()
}
