/**
 * @fileoverview The loading clips shown in the middle of {@link LoadingOverlay},
 * and the pieces of the choice worth testing on their own: which clip to draw,
 * and what to colour it with.
 *
 * The clips come from `grab-url/animations` — seventeen SVG loaders, each a
 * function returning markup. That subpath is safe to import from a component
 * in a way `grab-url/icons/quantum-sphere` was not: it exports plain
 * string-building functions, with no React bundled beside them. See
 * {@link AnimatedLoader} for what that cost the last time a package rendered
 * its own React here.
 *
 * Nothing here touches the DOM except {@link readAccentHue}, so the picking
 * and colouring rules stay plain functions over their inputs.
 */

import {
  loadingBouncyBall,
  loadingDoubleRing,
  loadingEclipse,
  loadingEllipsis,
  loadingFloatingSearch,
  loadingGears,
  loadingInfinity,
  loadingOrbital,
  loadingPacman,
  loadingPulseBars,
  loadingRedBlueBall,
  loadingReloadArrow,
  loadingRing,
  loadingRipple,
  loadingSpinner,
  loadingSpinnerOval,
  loadingSquareBlocks,
} from "grab-url/animations"

/**
 * The options `grab-url/animations` takes, redeclared because the package
 * describes the shape in a type it does not export.
 *
 * `raw` is the one that matters most here: left off, a builder wraps its
 * markup in an `<img src="data:…">`, which cannot be themed or paused. Every
 * call in this module passes it.
 */
export interface LoadingSvgOptions {
  /** Hex colours to substitute, in order of appearance in the markup. */
  colors?: string[]
  /** Width and height in pixels. */
  size?: number
  /** Return the SVG markup itself rather than an `<img>` wrapping it. */
  raw?: boolean
}

/** One of the clips, as the overlay picks and draws it. */
export interface LoadingAnimation {
  /** Stable name, used as a React key and to pin a clip in tests. */
  id: string
  /** Builds the clip's markup. */
  build: (options?: LoadingSvgOptions) => string
  /**
   * Whether the clip's first frame is empty — every shape starts collapsed
   * and only the animation gives it size.
   *
   * Only matters for the reduced-motion path, which holds a clip on that
   * first frame: holding one of these shows nothing at all, so
   * {@link pickLoadingAnimation} leaves them out of that draw.
   */
  blankAtStart?: boolean
}

/**
 * Every clip the overlay can draw, so a user who sits through a lot of
 * transitions doesn't see the same one each time.
 */
export const LOADING_ANIMATIONS: readonly LoadingAnimation[] = [
  { id: "bouncy-ball", build: loadingBouncyBall },
  { id: "double-ring", build: loadingDoubleRing },
  { id: "eclipse", build: loadingEclipse },
  { id: "ellipsis", build: loadingEllipsis },
  { id: "floating-search", build: loadingFloatingSearch },
  { id: "gears", build: loadingGears },
  { id: "infinity", build: loadingInfinity },
  { id: "orbital", build: loadingOrbital },
  { id: "pacman", build: loadingPacman },
  { id: "pulse-bars", build: loadingPulseBars },
  { id: "red-blue-ball", build: loadingRedBlueBall },
  { id: "reload-arrow", build: loadingReloadArrow },
  { id: "ring", build: loadingRing },
  // Both of the ripple's circles open at r="0" and are grown by the
  // animation, so its first frame is blank.
  { id: "ripple", build: loadingRipple, blankAtStart: true },
  { id: "spinner", build: loadingSpinner },
  { id: "spinner-oval", build: loadingSpinnerOval },
  { id: "square-blocks", build: loadingSquareBlocks },
]

interface PickOptions {
  /** Source of randomness; injected so tests can pin it. */
  random?: () => number
  /**
   * True when the clip will be held on its first frame rather than played,
   * which rules out the clips that have nothing to show there.
   */
  staticFrame?: boolean
}

/**
 * Choose the clip to draw this time round.
 *
 * Clamps rather than trusting an injected random source to stay within the
 * `[0, 1)` contract, so a bad source returns an end of the list instead of
 * `undefined`.
 */
export function pickLoadingAnimation({
  random = Math.random,
  staticFrame = false,
}: PickOptions = {}): LoadingAnimation {
  const pool = staticFrame
    ? LOADING_ANIMATIONS.filter((animation) => !animation.blankAtStart)
    : LOADING_ANIMATIONS

  const rolled = Math.floor(random() * pool.length)
  const index = Number.isFinite(rolled) ? Math.min(Math.max(rolled, 0), pool.length - 1) : 0
  return pool[index] as LoadingAnimation
}

/**
 * The hue the app falls back to when `--accent-hue` cannot be read — the
 * value `globals.css` ships as the default, so a server render and a browser
 * that hasn't applied the stylesheet yet agree with the themed result.
 */
export const FALLBACK_ACCENT_HUE = 192

/**
 * The ramp the clips are recoloured along, as `[hue offset, saturation,
 * lightness]` triples.
 *
 * Deliberately the same walk around the wheel as {@link OrbitalLoader}'s
 * lines, so the clips read as the same family as the orb the panels use
 * rather than as seventeen imported palettes.
 */
const ACCENT_RAMP: readonly (readonly [number, number, number])[] = [
  [0, 80, 70],
  [40, 80, 65],
  [80, 75, 60],
  [120, 70, 55],
  [160, 75, 60],
  [200, 80, 65],
  [240, 80, 70],
  [280, 80, 65],
  [320, 80, 70],
]

/**
 * The colours `grab-url` will substitute, which is to say every 3- or 6-digit
 * hex literal in the markup. Matched longest-first, so `#aabbcc` is one colour
 * rather than `#aab` followed by junk.
 */
const HEX_COLOR = /#[0-9a-fA-F]{6}|#[0-9a-fA-F]{3}/g

/**
 * How many colours a clip's markup carries.
 *
 * `grab-url` substitutes in order of appearance and stops when it runs out of
 * replacements, so a palette shorter than this leaves the tail of the clip in
 * the package's own colours — a half-recoloured loader. The caller counts
 * first and asks for exactly as many as the clip will consume.
 */
export function countSvgColors(svg: string): number {
  return (svg.match(HEX_COLOR) ?? []).length
}

/**
 * Convert an HSL triple to the `#rrggbb` literal `grab-url` substitution
 * needs.
 *
 * The clips are recoloured by string replacement, so `hsl(var(--accent-hue) …)`
 * is not on offer: anything that isn't already a hex literal gets a `#`
 * prepended and lands in the markup as nonsense.
 *
 * @param hue Degrees around the wheel; wrapped, so `-40` and `320` agree.
 * @param saturation Percentage, clamped to `[0, 100]`.
 * @param lightness Percentage, clamped to `[0, 100]`.
 */
export function hslToHex(hue: number, saturation: number, lightness: number): string {
  const h = ((hue % 360) + 360) % 360
  const s = Math.min(Math.max(saturation, 0), 100) / 100
  const l = Math.min(Math.max(lightness, 0), 100) / 100

  const chroma = (1 - Math.abs(2 * l - 1)) * s
  const second = chroma * (1 - Math.abs(((h / 60) % 2) - 1))
  const base = l - chroma / 2

  const sectors: readonly (readonly [number, number, number])[] = [
    [chroma, second, 0],
    [second, chroma, 0],
    [0, chroma, second],
    [0, second, chroma],
    [second, 0, chroma],
    [chroma, 0, second],
  ]
  const [r, g, b] = sectors[Math.floor(h / 60) % 6] as readonly [number, number, number]

  const channel = (value: number) =>
    Math.round((value + base) * 255)
      .toString(16)
      .padStart(2, "0")

  return `#${channel(r)}${channel(g)}${channel(b)}`
}

/**
 * Build `length` colours from the app's accent hue, cycling {@link ACCENT_RAMP}
 * so a clip with more colours than the ramp has entries keeps going round the
 * wheel rather than repeating one shade.
 *
 * @returns An empty palette for a non-positive or unreadable length, which
 *   `grab-url` treats as "leave the colours alone".
 */
export function accentPalette(hue: number, length: number): string[] {
  if (!Number.isFinite(length) || length <= 0) return []

  return Array.from({ length: Math.floor(length) }, (_, index) => {
    const [offset, saturation, lightness] = ACCENT_RAMP[
      index % ACCENT_RAMP.length
    ] as readonly [number, number, number]
    return hslToHex(hue + offset, saturation, lightness)
  })
}

/**
 * Read `--accent-hue` off the document, the same custom property the themes
 * set and {@link OrbitalLoader} draws from.
 *
 * Returns {@link FALLBACK_ACCENT_HUE} wherever there is no document to read
 * (the server render) so callers never have to branch.
 */
export function readAccentHue(): number {
  if (typeof document === "undefined") return FALLBACK_ACCENT_HUE
  return parseAccentHue(
    window.getComputedStyle(document.documentElement).getPropertyValue("--accent-hue"),
  )
}

/**
 * Parse a `--accent-hue` value into degrees.
 *
 * The property is a bare number so the themes can compose it inside
 * `hsl(calc(var(--accent-hue) + 40) …)`, and it comes back with whitespace, or
 * empty on a browser that hasn't applied the stylesheet to the element yet.
 */
export function parseAccentHue(value: string): number {
  const hue = Number.parseFloat(value)
  if (!Number.isFinite(hue)) return FALLBACK_ACCENT_HUE
  return ((hue % 360) + 360) % 360
}

interface RenderOptions {
  /** Width and height of the clip in pixels. */
  size: number
  /** Accent hue to recolour along; defaults to the stylesheet's own. */
  hue?: number
}

/**
 * Draw a clip at a size, in the app's accent colours.
 *
 * Builds the markup twice on purpose: once plain, to count the colours the
 * clip actually carries, and once with a palette of exactly that length. Both
 * passes are string work over a few kilobytes.
 *
 * @returns SVG markup, safe to inline — every byte of it comes from the
 *   package's own constants and the hex literals built above, with nothing
 *   user-supplied reaching it.
 */
export function renderLoadingAnimation(
  animation: LoadingAnimation,
  { size, hue = FALLBACK_ACCENT_HUE }: RenderOptions,
): string {
  const plain = animation.build({ raw: true })
  const colors = accentPalette(hue, countSvgColors(plain))
  return animation.build({ raw: true, size, colors })
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
