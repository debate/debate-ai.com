/**
 * @fileoverview The loading clip shown in the middle of {@link LoadingOverlay},
 * and the one piece of it worth testing on its own: where to start playing.
 *
 * Kept out of the component so the start-point rule is a plain function over
 * a duration — the component only has to hand it `video.duration` and a
 * random source.
 */

/**
 * Public path of the loop, copied from `public/` into the build output and
 * served from the site root.
 */
export const LOADING_VIDEO_SRC = "/loading.mp4"

/**
 * How much of the tail to keep out of the random range, in seconds.
 *
 * The clip loops, so a start point landing a moment before the end wraps back
 * to 0 almost immediately — which reads as a stutter rather than a loop. This
 * reserves enough runway that a typical overlay (a few hundred ms to a couple
 * of seconds) plays through without wrapping.
 */
const TAIL_RESERVE_SECONDS = 2

/**
 * Pick where in the clip to start this time round.
 *
 * Returns 0 for a duration that isn't a usable positive number — Safari
 * reports `Infinity` for a stream whose length it hasn't resolved yet, and a
 * failed load leaves `NaN` — so the caller can seek unconditionally.
 *
 * @param duration Clip length in seconds, i.e. `HTMLMediaElement.duration`.
 * @param random Source of randomness; injected so tests can pin it.
 * @returns A start offset in seconds, within `[0, duration)`.
 */
export function pickLoadingStartTime(
  duration: number,
  random: () => number = Math.random,
): number {
  if (!Number.isFinite(duration) || duration <= 0) return 0

  // Never reserve more than half the clip: a short loop would otherwise be
  // pinned to its first frames and stop looking random at all.
  const reserve = Math.min(TAIL_RESERVE_SECONDS, duration / 2)
  const usable = duration - reserve

  const start = random() * usable
  // `random()` is [0, 1), so this cannot reach `usable`; clamp anyway rather
  // than trust an injected source to respect the contract.
  return Math.min(Math.max(start, 0), Math.max(duration - 0.01, 0))
}

/**
 * How far off the requested start the element may land and still count as
 * having seeked there, in seconds. A seek snaps to the nearest keyframe, so
 * an exact match is not on offer; a quarter second is well inside one frame
 * of tolerance for the caller's purposes and well under a keyframe gap.
 */
const SEEK_TOLERANCE_SECONDS = 0.25

/**
 * Whether a requested seek actually took.
 *
 * Assigning `currentTime` is a request, and a silent no-op in more cases than
 * it looks: before the element has a seekable range it clamps to 0, and a
 * source served without byte ranges never becomes seekable at all. Since the
 * whole point of the clip is that it *doesn't* start at 0 every time, the
 * caller checks rather than assumes, and retries on a later event.
 *
 * @param currentTime The element's `currentTime` after the assignment.
 * @param target The start that was requested.
 */
export function seekLanded(currentTime: number, target: number): boolean {
  if (!Number.isFinite(currentTime) || !Number.isFinite(target)) return false
  return Math.abs(currentTime - target) <= SEEK_TOLERANCE_SECONDS
}

/**
 * Whether the viewer has asked the OS for reduced motion. Returns false
 * wherever `matchMedia` is unavailable (the server render, older browsers),
 * which is the "play it" default the overlay already assumed.
 */
export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return false
  }
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches
}
