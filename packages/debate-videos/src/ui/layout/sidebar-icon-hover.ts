/**
 * @fileoverview A random little animation on a sidebar icon whenever its row
 * is hovered or focused: a wiggle, bounce, pulse, spin or shake, never the
 * same one twice in a row, driven by Motion.
 *
 * It is attached once to a sidebar's root rather than wrapped around each
 * icon, so every row any tree puts in the column (links, buttons, tree items,
 * the account menu) gets it without the trees knowing. Hovering or focusing
 * a row animates the first icon in it; moving between the parts of one row
 * does not restart it. Under reduced motion nothing plays.
 *
 * @module ui/layout/sidebar-icon-hover
 */

import { animate, type AnimationPlaybackControls, type DOMKeyframesDefinition } from "motion"
import { useEffect, type RefObject } from "react"

import { prefersReducedMotion } from "./sidebar-peek-animations"

/** One hover effect: keyframes that start and end with the icon at rest. */
export interface IconHoverEffect {
  name: string
  keyframes: DOMKeyframesDefinition
  duration: number
}

/** The effects a hovered sidebar icon picks from. */
export const ICON_HOVER_EFFECTS: readonly IconHoverEffect[] = [
  { name: "wiggle", keyframes: { rotate: [0, -15, 15, -10, 10, 0] }, duration: 0.45 },
  { name: "bounce", keyframes: { y: [0, -6, 0, -3, 0] }, duration: 0.45 },
  { name: "pulse", keyframes: { scale: [1, 1.22, 0.95, 1.1, 1] }, duration: 0.45 },
  { name: "spin", keyframes: { rotate: [0, 360] }, duration: 0.5 },
  { name: "shake", keyframes: { x: [0, -3, 3, -3, 3, 0] }, duration: 0.4 },
]

/** Picks an effect at random, never `previous` again. */
export function pickIconHoverEffect(
  previous?: IconHoverEffect | null,
  random: () => number = Math.random,
): IconHoverEffect {
  const pool = previous ? ICON_HOVER_EFFECTS.filter((e) => e !== previous) : ICON_HOVER_EFFECTS
  return pool[Math.min(pool.length - 1, Math.floor(random() * pool.length))]
}

/** Every property an effect moves, at rest. */
const AT_REST: DOMKeyframesDefinition = { x: 0, y: 0, rotate: 0, scale: 1 }

/** What counts as one row of a sidebar. */
const ROW_SELECTOR = "a, button, [role='treeitem'], [role='button'], [role='menuitem'], summary"

/** The row `target` belongs to inside `root`, and the icon to animate in it. */
export function sidebarIconFor(target: EventTarget | null, root: Element): { row: Element; icon: SVGElement } | null {
  if (!(target instanceof Element)) return null
  const row = target.closest(ROW_SELECTOR)
  if (!row || !root.contains(row)) return null
  const icon = row.querySelector("svg")
  return icon ? { row, icon } : null
}

/**
 * Animates icons in `root` on hover and focus. Returns the function that
 * detaches it.
 */
export function attachSidebarIconHover(root: HTMLElement): () => void {
  let previous: IconHoverEffect | null = null
  const playing = new WeakMap<SVGElement, AnimationPlaybackControls>()

  const play = (icon: SVGElement) => {
    if (prefersReducedMotion()) return
    playing.get(icon)?.stop()
    const effect = pickIconHoverEffect(previous)
    previous = effect
    // From rest every time, so a stopped spin or bounce never leaves it
    // askew. Through Motion, which remembers each transform it set.
    animate(icon, AT_REST, { duration: 0 })
    playing.set(icon, animate(icon, effect.keyframes, { duration: effect.duration, ease: "easeInOut" }))
  }

  const onEnter = (event: PointerEvent | FocusEvent) => {
    if (event instanceof PointerEvent && event.pointerType === "touch") return
    const hit = sidebarIconFor(event.target, root)
    if (!hit) return
    // Moving between the parts of one row (its icon, its label) is not a new hover.
    const from = event.relatedTarget
    if (from instanceof Node && hit.row.contains(from)) return
    play(hit.icon)
  }

  root.addEventListener("pointerover", onEnter)
  root.addEventListener("focusin", onEnter)
  return () => {
    root.removeEventListener("pointerover", onEnter)
    root.removeEventListener("focusin", onEnter)
  }
}

/** Gives the sidebar under `ref` the random icon hover animation. */
export function useSidebarIconHover(ref: RefObject<HTMLElement | null>): void {
  useEffect(() => {
    const root = ref.current
    if (!root) return
    return attachSidebarIconHover(root)
  }, [ref])
}
