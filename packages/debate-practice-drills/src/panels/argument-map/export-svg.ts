/**
 * @fileoverview Turns a rendered argument-map chart (`ArgumentMapChart`'s
 * `<svg>`) into a standalone `.svg` file a debater can drop into slides or a
 * doc. The live chart leans on the page: Tailwind theme classes
 * (`fill-foreground`, `text-muted-foreground/50`, `text-[11px]`) and
 * `currentColor` resolve against the site's CSS, which an exported file does
 * not have. `buildArgumentMapSvg` clones the chart, swaps every known theme
 * class for an explicit attribute in a fixed light palette, drops the
 * interactive attributes (role, tabindex, event-only classes), and paints a
 * background so the file reads the same in any viewer.
 *
 * @module panels/argument-map/export-svg
 */

import type { ArgumentMapViewMode } from "../../flow/argument-map"

/** The fixed light palette an exported map is drawn in, whatever the site theme. */
export const ARGUMENT_MAP_EXPORT_PALETTE = {
  foreground: "#0f172a",
  mutedForeground: "rgba(100, 116, 139, 0.5)",
  background: "#ffffff",
} as const

export type ArgumentMapExportPalette = {
  foreground: string
  mutedForeground: string
  background: string
}

const SVG_NS = "http://www.w3.org/2000/svg"

/** Attributes only the live, interactive chart needs. */
const INTERACTIVE_ATTRIBUTES = ["role", "tabindex", "data-map-root"]

/**
 * Explicit attributes for each theme class `ArgumentMapChart` uses. A class
 * not listed here (layout-only ones like `shrink-0`, `cursor-pointer`) is
 * simply dropped.
 */
function classAttributes(className: string, palette: ArgumentMapExportPalette): Record<string, string> {
  const fontSize = /^text-\[(\d+(?:\.\d+)?)px\]$/.exec(className)
  if (fontSize) return { "font-size": `${fontSize[1]}px` }
  switch (className) {
    case "text-foreground":
      return { color: palette.foreground }
    case "text-muted-foreground/50":
      return { color: palette.mutedForeground }
    case "fill-foreground":
      return { fill: palette.foreground }
    case "stroke-foreground":
      return { stroke: palette.foreground }
    case "stroke-background":
      return { stroke: palette.background }
    default:
      return {}
  }
}

/** Replaces `el`'s classes with the explicit attributes they stand for, then removes the class attribute. */
function inlineClasses(el: Element, palette: ArgumentMapExportPalette): void {
  const className = el.getAttribute("class")
  if (className === null) return
  for (const token of className.split(/\s+/).filter(Boolean)) {
    for (const [name, value] of Object.entries(classAttributes(token, palette))) {
      el.setAttribute(name, value)
    }
  }
  el.removeAttribute("class")
}

/**
 * Serializes a rendered argument-map `<svg>` into a standalone SVG document
 * string. The source element is left untouched.
 *
 * @throws {Error} when `svg` is not an `<svg>` element.
 */
export function buildArgumentMapSvg(
  svg: Element,
  palette: ArgumentMapExportPalette = ARGUMENT_MAP_EXPORT_PALETTE,
): string {
  if (svg.localName !== "svg") throw new Error("buildArgumentMapSvg expects an <svg> element")

  const clone = svg.cloneNode(true) as Element
  for (const el of [clone, ...Array.from(clone.querySelectorAll("*"))]) {
    for (const name of INTERACTIVE_ATTRIBUTES) el.removeAttribute(name)
    inlineClasses(el, palette)
  }

  clone.setAttribute("xmlns", SVG_NS)
  clone.setAttribute("color", palette.foreground)
  clone.setAttribute("font-family", "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif")

  // A full-viewBox background rect, painted first, so the file is not transparent.
  const viewBox = (clone.getAttribute("viewBox") ?? "").trim().split(/[\s,]+/).map(Number)
  if (viewBox.length === 4 && viewBox.every(Number.isFinite)) {
    const background = clone.ownerDocument.createElementNS(SVG_NS, "rect")
    background.setAttribute("x", String(viewBox[0]))
    background.setAttribute("y", String(viewBox[1]))
    background.setAttribute("width", String(viewBox[2]))
    background.setAttribute("height", String(viewBox[3]))
    background.setAttribute("fill", palette.background)
    clone.insertBefore(background, clone.firstChild)
  }

  const markup = new XMLSerializer().serializeToString(clone)
  return `<?xml version="1.0" encoding="UTF-8"?>\n${markup}\n`
}

/**
 * A filesystem-safe filename for a map download, e.g.
 * `argument-map-round-4-sunburst.svg`. Same sanitization rule as
 * `flow/argument-tree-export.ts#argumentTreeOutlineFilename`.
 */
export function argumentMapSvgFilename(rootLabel: string, mode: ArgumentMapViewMode): string {
  const safeLabel = rootLabel
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
  return `argument-map-${safeLabel || "round"}-${mode}.svg`
}

/** Saves `markup` as a file via the anchor+Blob pattern the panel's outline download uses. */
export function downloadSvgFile(markup: string, filename: string): void {
  const blob = new Blob([markup], { type: "image/svg+xml" })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
