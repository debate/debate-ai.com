/**
 * @fileoverview Circular countdown-progress ring, extracted from the
 * debate-timer-progress browser extension's timer face
 * (apps/debate-timer-progress-ext/src/components/TimerFace.tsx) so it can be
 * reused as a standalone visual anywhere in the monorepo — e.g. as the art
 * for a nav/dock button, not just inside the extension's own timer face.
 *
 * @module timers/TimerProgressRing
 */

interface TimerProgressRingProps {
  /** 0 (fresh/full time left) to 1 (time's up). Clamped to that range. */
  progress: number
  /** Ring thickness in the 200x200 viewBox's own units. */
  strokeWidth?: number
  /** Classes on the wrapping <svg> — use a `text-*` class to color the ring via currentColor. */
  className?: string
}

/** Matches the extension's r=90 circle (stroke-dasharray: 565). */
const RADIUS = 90
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

/**
 * A ring-only (no fill) SVG progress indicator, starting at 12 o'clock and
 * sweeping clockwise as `progress` grows. Purely presentational: it owns no
 * timer state, so callers drive `progress` themselves.
 */
export function TimerProgressRing({ progress, strokeWidth = 10, className }: TimerProgressRingProps) {
  const clamped = Math.min(1, Math.max(0, progress))

  return (
    <svg
      viewBox="0 0 200 200"
      preserveAspectRatio="xMidYMid meet"
      aria-hidden="true"
      className={className}
      style={{ transform: "rotate(-90deg)", transformOrigin: "center" }}
    >
      <circle
        cx="100"
        cy="100"
        r={RADIUS}
        fill="none"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={CIRCUMFERENCE}
        strokeDashoffset={clamped * CIRCUMFERENCE}
        style={{ transition: "stroke-dashoffset 1s linear" }}
      />
    </svg>
  )
}
