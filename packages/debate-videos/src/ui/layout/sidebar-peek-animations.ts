/**
 * @fileoverview The entrances and exits a peeked sidebar plays, driven by
 * anime.js. Every time the hidden column peeks out or slides away, one of
 * {@link PEEK_ANIMATIONS} is picked at random (never the same one twice in a
 * row), so the column wiggles, flips, bounces or drops in a different way each
 * time.
 *
 * Entrances give explicit start values, so they always begin off-screen.
 * Exits give only end values, so an exit that interrupts an entrance carries
 * on from wherever the column is rather than jumping. anime.js remembers
 * each transform it has set on an element, so an entrance first resets them
 * all; otherwise a zoom after a slide would start, and stay, off-screen.
 *
 * @module ui/layout/sidebar-peek-animations
 */

import { animate, utils, type AnimationParams, type JSAnimation } from "animejs"

/** One entrance/exit pair for the peeked sidebar. */
export interface PeekAnimation {
  /** Short name, for tests and debugging. */
  name: string
  /** CSS `transform-origin` the animation pivots around. */
  origin?: string
  /** Played as the column peeks out. */
  in: AnimationParams
  /** Played as the column slides away. */
  out: AnimationParams
}

const slideOut: AnimationParams = { translateX: "-100%", opacity: 0, duration: 220, ease: "inCubic" }

/** The ten ways a peeked sidebar can come and go. */
export const PEEK_ANIMATIONS: readonly PeekAnimation[] = [
  {
    name: "slide",
    in: { translateX: ["-100%", "0%"], duration: 320, ease: "outExpo" },
    out: slideOut,
  },
  {
    name: "elastic",
    in: { translateX: ["-100%", "0%"], duration: 900, ease: "outElastic(1, .6)" },
    out: { translateX: "-100%", duration: 380, ease: "inBack(1.7)" },
  },
  {
    name: "wiggle",
    origin: "left center",
    in: {
      translateX: { from: "-100%", to: "0%", duration: 260, ease: "outCubic" },
      rotate: [{ from: -6, to: 4, duration: 180 }, { to: -3 }, { to: 2 }, { to: 0 }],
      ease: "inOutSine",
      duration: 120,
    },
    out: {
      rotate: [{ to: 3, duration: 80 }, { to: -3, duration: 80 }, { to: 0, duration: 60 }],
      translateX: { to: "-100%", delay: 200, duration: 200, ease: "inCubic" },
    },
  },
  {
    name: "zoom",
    origin: "left center",
    in: { scale: [0.8, 1], opacity: [0, 1], duration: 380, ease: "outBack(2)" },
    out: { scale: 0.8, opacity: 0, duration: 200, ease: "inQuad" },
  },
  {
    name: "flip",
    origin: "left center",
    in: { perspective: "1200px", rotateY: [-90, 0], opacity: [0, 1], duration: 520, ease: "outBack(1.4)" },
    out: { perspective: "1200px", rotateY: -90, opacity: 0, duration: 260, ease: "inCubic" },
  },
  {
    name: "bounce",
    in: { translateX: ["-100%", "0%"], duration: 750, ease: "outBounce" },
    out: { translateX: "-100%", duration: 300, ease: "inBack(1.4)" },
  },
  {
    name: "swing",
    origin: "left top",
    in: { translateX: ["-100%", "0%"], skewX: [25, 0], duration: 600, ease: "outElastic(1, .5)" },
    out: { skewX: 20, translateX: "-100%", duration: 260, ease: "inCubic" },
  },
  {
    name: "drop",
    in: { translateY: ["-100%", "0%"], opacity: [0, 1], duration: 700, ease: "outBounce" },
    out: { translateY: "100%", opacity: 0, duration: 260, ease: "inCubic" },
  },
  {
    name: "blur",
    in: { filter: ["blur(16px)", "blur(0px)"], opacity: [0, 1], translateX: ["-30%", "0%"], duration: 420, ease: "outQuad" },
    out: { filter: "blur(16px)", opacity: 0, translateX: "-30%", duration: 240, ease: "inQuad" },
  },
  {
    name: "jelly",
    origin: "left center",
    in: {
      scaleX: [{ from: 0.1, to: 1.12, duration: 260, ease: "outQuad" }, { to: 0.94 }, { to: 1.03 }, { to: 1 }],
      scaleY: [{ from: 0.9, to: 0.94, duration: 260 }, { to: 1.04 }, { to: 0.99 }, { to: 1 }],
      duration: 130,
      ease: "inOutSine",
    },
    out: {
      scaleX: [{ to: 1.08, duration: 90 }, { to: 0, duration: 200, ease: "inQuad" }],
      opacity: { to: 0, delay: 150, duration: 140 },
    },
  },
]

/**
 * Picks one of {@link PEEK_ANIMATIONS} at random, skipping `previous` so the
 * same animation never plays twice in a row.
 */
export function pickPeekAnimation(previous?: PeekAnimation | null, random: () => number = Math.random): PeekAnimation {
  const pool = previous ? PEEK_ANIMATIONS.filter((a) => a !== previous) : PEEK_ANIMATIONS
  return pool[Math.min(pool.length - 1, Math.floor(random() * pool.length))]
}

/** Whether the viewer asked for reduced motion, where the column just appears and goes. */
export function prefersReducedMotion(): boolean {
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches
  } catch {
    return false
  }
}

/** Every property any animation touches, at rest. */
const AT_REST = {
  translateX: "0%",
  translateY: "0%",
  rotate: 0,
  rotateY: 0,
  skewX: 0,
  scale: 1,
  scaleX: 1,
  scaleY: 1,
  opacity: 1,
  filter: "blur(0px)",
}

/** Plays `animation`'s entrance or exit on `el`, calling `onComplete` when it finishes. */
export function playPeekAnimation(
  el: HTMLElement,
  animation: PeekAnimation,
  direction: "in" | "out",
  onComplete?: () => void,
): JSAnimation {
  if (direction === "in") utils.set(el, AT_REST)
  el.style.transformOrigin = animation.origin ?? "left center"
  return animate(el, { ...animation[direction], onComplete: () => onComplete?.() })
}
