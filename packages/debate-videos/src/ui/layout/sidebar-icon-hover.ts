/**
 * @fileoverview A random little animation on a sidebar icon whenever its row
 * (icon or label) is hovered or focused: a wiggle, bounce, pulse, spin, shake,
 * flip, jelly or tada, never the same one twice in a row, lasting 0.5s or 1s
 * (also picked at random), driven by anime.js. The icon also takes a random
 * color while it plays. Each icon plays at most once every 3 seconds, so
 * sweeping the pointer down the column doesn't keep it twitching.
 *
 * It is attached once to a sidebar's root rather than wrapped around each
 * icon, so every row any tree puts in the column (links, buttons, tree items,
 * the account menu) gets it without the trees knowing. Hovering or focusing
 * a row animates the first icon in it; moving between the parts of one row
 * does not restart it. Under reduced motion the icon only changes color.
 *
 * It is off by default: nothing moves until the reader turns on "Animate
 * sidebar icons" in Settings → Preferences ({@link setSidebarIconAnimations}).
 *
 * @module ui/layout/sidebar-icon-hover
 */

import { animate, utils, type AnimationParams } from "animejs"
import { useEffect, type RefObject } from "react"

import { prefersReducedMotion } from "./sidebar-peek-animations"

/** Colors the icon can take while it plays — chosen at random each time. */
export const ICON_HOVER_COLORS = [
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
export const ICON_HOVER_THROTTLE_MS = 3_000

/** One hover effect: anime.js keyframes that start and end with the icon at rest. */
export interface IconHoverEffect {
  name: string
  keyframes: AnimationParams
}

/** The effects a hovered sidebar icon picks from. */
export const ICON_HOVER_EFFECTS: readonly IconHoverEffect[] = [
  { name: "wiggle", keyframes: { rotate: [0, -15, 15, -10, 10, 0] } },
  { name: "bounce", keyframes: { translateY: [0, -6, 0, -3, 0] } },
  { name: "pulse", keyframes: { scale: [1, 1.22, 0.95, 1.1, 1] } },
  { name: "spin", keyframes: { rotate: [0, 360] } },
  { name: "shake", keyframes: { translateX: [0, -3, 3, -3, 3, 0] } },
  { name: "flip", keyframes: { rotateY: [0, 180, 360] } },
  { name: "jelly", keyframes: { scaleX: [1, 1.25, 0.85, 1.1, 1], scaleY: [1, 0.8, 1.15, 0.95, 1] } },
  { name: "tada", keyframes: { scale: [1, 0.9, 1.15, 1.15, 1], rotate: [0, -8, 8, -8, 0] } },
]

/** Picks one of {@link ICON_HOVER_COLORS} at random. */
export function pickIconHoverColor(random: () => number = Math.random): string {
  return ICON_HOVER_COLORS[Math.min(ICON_HOVER_COLORS.length - 1, Math.floor(random() * ICON_HOVER_COLORS.length))]
}

/**
 * True when an icon last played at `last` (ms) may play again at `now`:
 * at most once per {@link ICON_HOVER_THROTTLE_MS}.
 */
export function iconHoverReady(last: number | undefined, now: number): boolean {
  return last === undefined || now - last >= ICON_HOVER_THROTTLE_MS
}

/** How long one hover animation lasts, in seconds — chosen at random each hover. */
export const ICON_HOVER_DURATIONS = [0.5, 1] as const

/** Picks a hover duration at random from {@link ICON_HOVER_DURATIONS}. */
export function pickIconHoverDuration(random: () => number = Math.random): number {
  const i = Math.min(ICON_HOVER_DURATIONS.length - 1, Math.floor(random() * ICON_HOVER_DURATIONS.length))
  return ICON_HOVER_DURATIONS[i]
}

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
const AT_REST = { translateX: 0, translateY: 0, rotate: 0, rotateY: 0, scale: 1, scaleX: 1, scaleY: 1 }

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
  /** Per-icon time the last animation started, for the 3s throttle. */
  const lastPlayedAt = new WeakMap<SVGElement, number>()

  const play = (icon: SVGElement) => {
    // Off unless the reader turned it on (Settings → Preferences); read on
    // every hover so flipping the switch applies without a reload.
    if (!readSidebarIconAnimations()) return

    const now = Date.now()
    if (!iconHoverReady(lastPlayedAt.get(icon), now)) return
    lastPlayedAt.set(icon, now)

    const duration = pickIconHoverDuration() * 1000
    const originalColor = icon.style.color
    icon.style.color = pickIconHoverColor()
    const restoreColor = () => {
      icon.style.color = originalColor
    }

    // Reduced motion: the color alone, nothing moves.
    if (prefersReducedMotion()) {
      window.setTimeout(restoreColor, duration)
      return
    }

    const effect = pickIconHoverEffect(previous)
    previous = effect
    // From rest every time; anime.js remembers each transform it set, so a
    // flip after a spin starts upright rather than wherever the last one was.
    utils.set(icon, AT_REST)
    // The throttle outlasts the longest effect, so nothing is ever cut short.
    animate(icon, { ...effect.keyframes, duration, ease: "inOutSine", onComplete: restoreColor })
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
