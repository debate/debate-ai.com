/**
 * @fileoverview A random little animation on a sidebar icon whenever its row
 * is hovered or focused: a wiggle, bounce, pulse, spin or shake, never the
 * same one twice in a row, driven by Motion. Each icon also gets a random
 * color flash — throttled to once per 5 seconds so the sidebar stays calm.
 *
 * It is attached once to a sidebar's root rather than wrapped around each
 * icon, so every row any tree puts in the column (links, buttons, tree items,
 * the account menu) gets it without the trees knowing. Hovering or focusing
 * a row animates the first icon in it; moving between the parts of one row
 * does not restart it. Under reduced motion nothing plays.
 *
 * It is off by default: nothing moves until the reader turns on "Animate
 * sidebar icons" in Settings → Preferences ({@link setSidebarIconAnimations}).
 *
 * @module ui/layout/sidebar-icon-hover
 */

import { animate, type AnimationPlaybackControls, type DOMKeyframesDefinition } from "motion"
import { useEffect, type RefObject } from "react"

import { prefersReducedMotion } from "./sidebar-peek-animations"

/** Colors the icon can flash — chosen at random each time. */
const ICON_HOVER_COLORS = [
  "hsl(142 76% 36%)",   // emerald
  "hsl(217 91% 60%)",   // blue
  "hsl(38 92% 50%)",    // amber
  "hsl(330 81% 60%)",   // pink
  "hsl(262 83% 58%)",   // violet
  "hsl(199 89% 48%)",   // sky
  "hsl(34 100% 52%)",   // orange
  "hsl(162 73% 42%)",   // teal
] as const

/** Minimum time between two animations on the same icon, in ms. */
const ICON_HOVER_THROTTLE_MS = 5_000

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

/** localStorage key for the reader's choice; "1" = animate. Off by default. */
export const SIDEBAR_ICON_ANIMATIONS_KEY = "sidebar-icon-animations"

/** Same-document change event; other tabs get the real `storage` event. */
const ICON_ANIMATIONS_CHANGE_EVENT = "sidebar-icon-animations-change"

/** True when the reader turned the icon hover animation on in Settings. */
export function readSidebarIconAnimations(): boolean {
  try {
    return localStorage.getItem(SIDEBAR_ICON_ANIMATIONS_KEY) === "1"
  } catch {
    return false
  }
}

/** Turns the icon hover animation on or off in this browser, and remembers it. */
export function setSidebarIconAnimations(on: boolean): void {
  try {
    if (on) localStorage.setItem(SIDEBAR_ICON_ANIMATIONS_KEY, "1")
    else localStorage.removeItem(SIDEBAR_ICON_ANIMATIONS_KEY)
  } catch {
    // Blocked storage: the choice just isn't kept.
  }
  window.dispatchEvent(new Event(ICON_ANIMATIONS_CHANGE_EVENT))
}

/** Calls `onChange` whenever the choice changes, here or in another tab. */
export function subscribeSidebarIconAnimations(onChange: () => void): () => void {
  const onStorage = (event: StorageEvent) => {
    if (event.key === null || event.key === SIDEBAR_ICON_ANIMATIONS_KEY) onChange()
  }
  window.addEventListener(ICON_ANIMATIONS_CHANGE_EVENT, onChange)
  window.addEventListener("storage", onStorage)
  return () => {
    window.removeEventListener(ICON_ANIMATIONS_CHANGE_EVENT, onChange)
    window.removeEventListener("storage", onStorage)
  }
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
  /** Per-icon timestamp of the last animation start, for the 5s throttle. */
  const lastAnimationAt = new WeakMap<SVGElement, number>()

  const play = (icon: SVGElement) => {
    // Off unless the reader turned it on (Settings → Preferences); read on
    // every hover so flipping the switch applies without a reload.
    if (!readSidebarIconAnimations() || prefersReducedMotion()) return

    // Throttle: only animate once per ICON_HOVER_THROTTLE_MS per icon.
    const now = Date.now()
    const last = lastAnimationAt.get(icon) ?? 0
    if (now - last < ICON_HOVER_THROTTLE_MS) return
    lastAnimationAt.set(icon, now)

    playing.get(icon)?.stop()
    const effect = pickIconHoverEffect(previous)
    previous = effect

    // Pick a random hover color and apply it.
    const color = ICON_HOVER_COLORS[Math.floor(Math.random() * ICON_HOVER_COLORS.length)]
    const originalColor = icon.style.color
    icon.style.color = color

    // From rest every time, so a stopped spin or bounce never leaves it
    // askew. Through Motion, which remembers each transform it set.
    animate(icon, AT_REST, { duration: 0 })
    const ctrl = animate(icon, effect.keyframes, { duration: effect.duration, ease: "easeInOut" })
    playing.set(icon, ctrl)

    // Restore the original color when the animation finishes.
    ctrl.finished.finally(() => {
      icon.style.color = originalColor
    })
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
