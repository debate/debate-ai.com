/**
 * @fileoverview Pan/zoom math for the "Who debated whom" graph: a view is the
 * SVG group's `translate(x,y) scale(k)`, and zooming keeps the point under
 * the cursor (or pinch midpoint) fixed on screen.
 * @module @debate-ai/rankings/leaderboard/network/networkZoom
 */

export type NetworkView = { x: number; y: number; k: number }

export const MIN_ZOOM = 0.6
export const MAX_ZOOM = 8

/** Pixels of wheel travel are scaled to this exponent; larger zooms faster. */
const WHEEL_SENSITIVITY = 0.0015
/** Trackpad pinch gestures arrive as ctrl+wheel with small deltas. */
const PINCH_WHEEL_SENSITIVITY = 0.01
/** Approximate pixels per line for `deltaMode === 1` wheels. */
const LINE_HEIGHT_PX = 16

export function clampZoom(k: number): number {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, k))
}

/**
 * Multiplies the zoom by `factor` (clamped to the zoom range) about the
 * point `(cx, cy)` in graph coordinates, so that point stays put on screen.
 */
export function zoomAbout(view: NetworkView, factor: number, cx: number, cy: number): NetworkView {
  const k = clampZoom(view.k * factor)
  if (k === view.k) return view
  const ratio = k / view.k
  return { k, x: cx - (cx - view.x) * ratio, y: cy - (cy - view.y) * ratio }
}

/** The zoom factor one wheel event asks for: scroll up (negative delta) zooms in. */
export function wheelZoomFactor(event: { deltaY: number; deltaMode: number; ctrlKey: boolean }): number {
  const pixels = event.deltaMode === 1 ? event.deltaY * LINE_HEIGHT_PX : event.deltaMode === 2 ? event.deltaY * 100 : event.deltaY
  return Math.exp(-pixels * (event.ctrlKey ? PINCH_WHEEL_SENSITIVITY : WHEEL_SENSITIVITY))
}
