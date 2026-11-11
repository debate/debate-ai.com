/**
 * @fileoverview Saves an argument-map view as a one-page `.pdf`, for handing
 * a judge or coach a file that prints and opens anywhere. It reuses the PNG
 * path: the standalone markup from `buildArgumentMapSvg` is rasterized (as
 * JPEG, which PDF embeds as-is with `/DCTDecode`) at 2x, then wrapped in a
 * minimal PDF whose page is the chart's on-screen size in points, so the
 * printed map is the size it looked on screen and stays crisp.
 *
 * The PDF writer is dependency-free (no pdf-lib/jsPDF in this package) and
 * pure, so its byte layout is unit-tested directly.
 *
 * @module panels/argument-map/export-pdf
 */

import type { ArgumentMapViewMode } from "../../flow/argument-map"
import { argumentMapSvgFilename } from "./export-svg"
import {
  ARGUMENT_MAP_PNG_SCALE,
  DEFAULT_RASTERIZE_DEPS,
  argumentMapPngSize,
  rasterizeSvgToImage,
  type PngSize,
  type RasterizeDeps,
} from "./export-png"

/** CSS pixels (1/96 in) to PDF points (1/72 in). */
const POINTS_PER_PIXEL = 72 / 96

/** JPEG quality for the embedded image; high, since the map is mostly flat colour and text. */
export const ARGUMENT_MAP_PDF_JPEG_QUALITY = 0.92

/** `argument-map-<label>-<mode>.pdf`, same slug rule as the SVG filename. */
export function argumentMapPdfFilename(rootLabel: string, mode: ArgumentMapViewMode): string {
  return argumentMapSvgFilename(rootLabel, mode).replace(/\.svg$/, ".pdf")
}

/**
 * The PDF page size, in points, for a chart: its on-screen CSS size (from
 * `width`/`height`, or the `viewBox`) converted at 96 px = 72 pt. Returns
 * `null` when the element has no usable size.
 */
export function argumentMapPdfPageSize(svg: Element): PngSize | null {
  const base = argumentMapPngSize(svg, 1, Number.POSITIVE_INFINITY)
  if (!base) return null
  return {
    width: Math.max(1, Math.round(base.width * POINTS_PER_PIXEL)),
    height: Math.max(1, Math.round(base.height * POINTS_PER_PIXEL)),
  }
}

function ascii(text: string): Uint8Array {
  const bytes = new Uint8Array(text.length)
  for (let i = 0; i < text.length; i++) bytes[i] = text.charCodeAt(i) & 0xff
  return bytes
}

function positiveInteger(n: number): boolean {
  return Number.isInteger(n) && n > 0
}

/**
 * A single-page PDF showing one JPEG scaled to fill a `page` (in points).
 * `image` is the JPEG's pixel size, which PDF needs in the image dictionary.
 *
 * @throws {Error} when the bytes are not a JPEG or a size is not a positive integer.
 */
export function buildImagePdf(jpeg: Uint8Array, image: PngSize, page: PngSize): Uint8Array<ArrayBuffer> {
  if (jpeg.length < 2 || jpeg[0] !== 0xff || jpeg[1] !== 0xd8) {
    throw new Error("buildImagePdf expects JPEG bytes")
  }
  if (![image.width, image.height, page.width, page.height].every(positiveInteger)) {
    throw new Error("buildImagePdf expects positive integer sizes")
  }

  const content = `q ${page.width} 0 0 ${page.height} 0 0 cm /Im0 Do Q`
  const objects: Uint8Array[][] = [
    [ascii("<< /Type /Catalog /Pages 2 0 R >>")],
    [ascii("<< /Type /Pages /Kids [3 0 R] /Count 1 >>")],
    [
      ascii(
        `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${page.width} ${page.height}] ` +
          "/Resources << /XObject << /Im0 5 0 R >> >> /Contents 4 0 R >>",
      ),
    ],
    [ascii(`<< /Length ${content.length} >>\nstream\n${content}\nendstream`)],
    [
      ascii(
        `<< /Type /XObject /Subtype /Image /Width ${image.width} /Height ${image.height} ` +
          `/ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`,
      ),
      jpeg,
      ascii("\nendstream"),
    ],
  ]

  // Binary-comment line after the header tells tools the file holds binary data.
  const parts: Uint8Array[] = [ascii("%PDF-1.4\n%\xe2\xe3\xcf\xd3\n")]
  let offset = parts[0].length
  const offsets: number[] = []
  objects.forEach((chunks, index) => {
    offsets.push(offset)
    const objectParts = [ascii(`${index + 1} 0 obj\n`), ...chunks, ascii("\nendobj\n")]
    for (const part of objectParts) {
      parts.push(part)
      offset += part.length
    }
  })

  const xref =
    `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n` +
    offsets.map((o) => `${String(o).padStart(10, "0")} 00000 n \n`).join("") +
    `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${offset}\n%%EOF\n`
  parts.push(ascii(xref))

  const out = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0))
  let cursor = 0
  for (const part of parts) {
    out.set(part, cursor)
    cursor += part.length
  }
  return out
}

/**
 * Rasterizes a rendered argument-map `<svg>` (via its standalone `markup`)
 * and wraps it in a one-page PDF blob.
 *
 * @throws {Error} (rejects) when the chart has no size, or rasterizing fails.
 */
export async function argumentMapToPdf(
  svg: Element,
  markup: string,
  deps: RasterizeDeps = DEFAULT_RASTERIZE_DEPS,
): Promise<Blob> {
  const page = argumentMapPdfPageSize(svg)
  const raster = argumentMapPngSize(svg, ARGUMENT_MAP_PNG_SCALE)
  if (!page || !raster) throw new Error("This map view has no size to export yet")
  const jpeg = await rasterizeSvgToImage(markup, raster, "image/jpeg", deps, ARGUMENT_MAP_PDF_JPEG_QUALITY)
  const bytes = buildImagePdf(new Uint8Array(await jpeg.arrayBuffer()), raster, page)
  return new Blob([bytes], { type: "application/pdf" })
}
