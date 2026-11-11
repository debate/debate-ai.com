/**
 * @fileoverview Rasterizes an argument-map export to a `.png`, for tools that
 * will not take an SVG (some slide decks, chat apps, image boards). It starts
 * from the same standalone markup `buildArgumentMapSvg` produces, so the PNG
 * carries the same fixed light palette and background, then draws it onto a
 * canvas at 2x the chart's on-screen size for a crisp image on high-DPI
 * screens and projectors.
 *
 * The browser pieces (image decode, canvas) are injectable so the module is
 * testable without a real canvas.
 *
 * @module panels/argument-map/export-png
 */

import type { ArgumentMapViewMode } from "../../flow/argument-map"
import { argumentMapSvgFilename } from "./export-svg"

/** Pixel density of an exported PNG relative to the chart's on-screen size. */
export const ARGUMENT_MAP_PNG_SCALE = 2

/**
 * Largest canvas side used for an export. Browsers cap canvas size (Safari
 * at roughly 16.7M pixels in total), so a very deep map is scaled down to fit
 * rather than producing an empty or failed image.
 */
export const ARGUMENT_MAP_PNG_MAX_SIDE = 4096

export type PngSize = { width: number; height: number }

function positive(value: string | null): number | null {
  if (value === null) return null
  const n = Number.parseFloat(value)
  return Number.isFinite(n) && n > 0 ? n : null
}

/**
 * The pixel size to draw a chart at: its `width`/`height` attributes (falling
 * back to the `viewBox`) times `scale`, shrunk proportionally so neither side
 * exceeds `maxSide`. Returns `null` when the element has no usable size.
 */
export function argumentMapPngSize(
  svg: Element,
  scale: number = ARGUMENT_MAP_PNG_SCALE,
  maxSide: number = ARGUMENT_MAP_PNG_MAX_SIDE,
): PngSize | null {
  const viewBox = (svg.getAttribute("viewBox") ?? "").trim().split(/[\s,]+/).map(Number)
  const hasViewBox = viewBox.length === 4 && viewBox.every(Number.isFinite) && viewBox[2] > 0 && viewBox[3] > 0
  const baseWidth = positive(svg.getAttribute("width")) ?? (hasViewBox ? viewBox[2] : null)
  const baseHeight = positive(svg.getAttribute("height")) ?? (hasViewBox ? viewBox[3] : null)
  if (baseWidth === null || baseHeight === null || !(scale > 0)) return null

  let width = baseWidth * scale
  let height = baseHeight * scale
  const shrink = Math.min(1, maxSide / width, maxSide / height)
  width = Math.max(1, Math.round(width * shrink))
  height = Math.max(1, Math.round(height * shrink))
  return { width, height }
}

/** `argument-map-<label>-<mode>.png`, same slug rule as the SVG filename. */
export function argumentMapPngFilename(rootLabel: string, mode: ArgumentMapViewMode): string {
  return argumentMapSvgFilename(rootLabel, mode).replace(/\.svg$/, ".png")
}

/** The browser pieces `rasterizeSvgToPng` needs; swapped out in tests. */
export type RasterizeDeps = {
  loadImage: (src: string) => Promise<CanvasImageSource>
  createCanvas: (width: number, height: number) => HTMLCanvasElement
}

function loadImageElement(src: string): Promise<CanvasImageSource> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error("The map image could not be loaded for PNG export"))
    image.src = src
  })
}

function createCanvasElement(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement("canvas")
  canvas.width = width
  canvas.height = height
  return canvas
}

export const DEFAULT_RASTERIZE_DEPS: RasterizeDeps = {
  loadImage: loadImageElement,
  createCanvas: createCanvasElement,
}

/**
 * A `data:` URL for SVG markup. A data URL (rather than a blob URL) keeps the
 * canvas untainted in every browser, so `toBlob` is allowed.
 */
export function svgDataUrl(markup: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(markup)}`
}

/** Raster formats an export can be encoded as. */
export type RasterImageType = "image/png" | "image/jpeg"

const RASTER_LABELS: Record<RasterImageType, string> = { "image/png": "PNG", "image/jpeg": "JPEG" }

/**
 * Draws standalone SVG markup onto a canvas of `size` and encodes it as
 * `type`. JPEG has no alpha channel, so the canvas is painted white first and
 * any transparent pixel comes out white rather than black.
 *
 * @throws {Error} (rejects) when the image fails to decode, the canvas has no
 * 2D context, or encoding yields no blob.
 */
export async function rasterizeSvgToImage(
  markup: string,
  size: PngSize,
  type: RasterImageType,
  deps: RasterizeDeps = DEFAULT_RASTERIZE_DEPS,
  quality?: number,
): Promise<Blob> {
  const image = await deps.loadImage(svgDataUrl(markup))
  const canvas = deps.createCanvas(size.width, size.height)
  const context = canvas.getContext("2d")
  if (!context) throw new Error("This browser cannot draw the map to an image")
  if (type === "image/jpeg") {
    context.fillStyle = "#ffffff"
    context.fillRect(0, 0, size.width, size.height)
  }
  context.drawImage(image, 0, 0, size.width, size.height)
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob)
        else reject(new Error(`The map could not be encoded as a ${RASTER_LABELS[type]}`))
      },
      type,
      quality,
    )
  })
}

/**
 * Draws standalone SVG markup onto a canvas of `size` and encodes it as PNG.
 *
 * @throws {Error} (rejects) when the image fails to decode, the canvas has no
 * 2D context, or encoding yields no blob.
 */
export function rasterizeSvgToPng(
  markup: string,
  size: PngSize,
  deps: RasterizeDeps = DEFAULT_RASTERIZE_DEPS,
): Promise<Blob> {
  return rasterizeSvgToImage(markup, size, "image/png", deps)
}
