/**
 * @fileoverview Carries the site font into an exported argument map.
 *
 * `buildArgumentMapSvg` used to stamp a fixed system font stack on every
 * export, so a map drawn on screen in the reader's chosen face (Settings →
 * font family, or the colour theme's `--font-sans`) came out in another one.
 * Worse, PNG and PDF exports rasterize the SVG through an `<img>`, which may
 * not load any outside resource, so even naming a web font there falls back
 * to whatever the browser has installed.
 *
 * {@link resolveArgumentMapExportFont} reads the chart's computed
 * `font-family`, finds the matching `@font-face` rules the page has loaded
 * (same-origin sheets through `cssRules`, cross-origin ones such as Google
 * Fonts by fetching their CSS, which is served with CORS), keeps only the
 * faces the map's text needs (normal style, the weights used, a
 * `unicode-range` that covers the labels), and inlines those font files as
 * `data:` URLs. The result goes into a `<style>` inside the exported SVG, so
 * the file, and the PNG / PDF drawn from it, render in the same face as the
 * screen.
 *
 * Embedding is best effort: a font that can't be found or fetched, or that
 * would push the embedded fonts past {@link MAX_EMBEDDED_FONT_BYTES}, is left
 * out and the export falls back to the named stack. It never fails an export.
 *
 * @module panels/argument-map/export-fonts
 */

/** The stack an export falls back to when the site face can't be used. */
export const ARGUMENT_MAP_FALLBACK_FONT_STACK = "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"

/** Cap on the font bytes inlined into one export (before base64), so a map stays a reasonable size. */
export const MAX_EMBEDDED_FONT_BYTES = 1_500_000

/** One `@font-face` rule, reduced to what embedding needs. */
export type FontFaceSource = {
  family: string
  style: string
  weight: string
  unicodeRange: string | null
  /** The first `url(…)` in `src`, resolved against the stylesheet's URL. */
  url: string
  format: string | null
}

/** What an export should name and embed. */
export type ArgumentMapExportFont = {
  /** Value for the exported `<svg font-family>`: the page's stack, then the fallback stack. */
  fontFamily: string
  /** `@font-face` rules with inlined `data:` sources; empty when nothing could be embedded. */
  fontFaceCss: string
}

const GENERIC_FAMILIES = new Set([
  "serif",
  "sans-serif",
  "monospace",
  "cursive",
  "fantasy",
  "system-ui",
  "ui-serif",
  "ui-sans-serif",
  "ui-monospace",
  "ui-rounded",
  "emoji",
  "math",
  "fangsong",
  "-apple-system",
  "blinkmacsystemfont",
  "inherit",
  "initial",
  "unset",
])

/** Splits a CSS list on commas that are not inside quotes. */
function splitCssList(value: string): string[] {
  const parts: string[] = []
  let current = ""
  let quote: string | null = null
  for (const ch of value) {
    if (quote) {
      if (ch === quote) quote = null
      current += ch
    } else if (ch === '"' || ch === "'") {
      quote = ch
      current += ch
    } else if (ch === ",") {
      parts.push(current)
      current = ""
    } else {
      current += ch
    }
  }
  parts.push(current)
  return parts.map((p) => p.trim()).filter(Boolean)
}

function unquote(value: string): string {
  const trimmed = value.trim()
  const match = /^(['"])(.*)\1$/.exec(trimmed)
  return match ? match[2] : trimmed
}

/**
 * The first named (non-generic) family in a CSS `font-family` value, unquoted,
 * or `null` when the list names only generic families.
 */
export function primaryFontFamily(fontFamily: string): string | null {
  for (const part of splitCssList(fontFamily)) {
    const name = unquote(part)
    if (!name || name.startsWith("var(")) continue
    if (GENERIC_FAMILIES.has(name.toLowerCase())) continue
    return name
  }
  return null
}

/**
 * The `font-family` an export names: the page's own stack followed by
 * {@link ARGUMENT_MAP_FALLBACK_FONT_STACK}, or just the fallback when the page
 * gives nothing usable.
 */
export function exportFontStack(pageFontFamily: string | null | undefined): string {
  const page = (pageFontFamily ?? "").trim()
  if (!page || page.includes("var(") || primaryFontFamily(page) === null) return ARGUMENT_MAP_FALLBACK_FONT_STACK
  return `${page}, ${ARGUMENT_MAP_FALLBACK_FONT_STACK}`
}

function declarations(body: string): Map<string, string> {
  const out = new Map<string, string>()
  for (const decl of body.split(";")) {
    const colon = decl.indexOf(":")
    if (colon < 0) continue
    const name = decl.slice(0, colon).trim().toLowerCase()
    const value = decl.slice(colon + 1).trim()
    if (name && value) out.set(name, value)
  }
  return out
}

function resolveUrl(url: string, baseUrl: string | undefined): string | null {
  try {
    return new URL(url, baseUrl).href
  } catch {
    return null
  }
}

/**
 * Parses every `@font-face` block in `cssText`. Rules without a family or a
 * `url(…)` source (a `local()`-only face) are skipped; relative URLs resolve
 * against `baseUrl` (the stylesheet's own URL).
 */
export function parseFontFaceRules(cssText: string, baseUrl?: string): FontFaceSource[] {
  const faces: FontFaceSource[] = []
  const withoutComments = cssText.replace(/\/\*[\s\S]*?\*\//g, "")
  for (const match of withoutComments.matchAll(/@font-face\s*\{([^}]*)\}/gi)) {
    const decls = declarations(match[1])
    const family = decls.get("font-family")
    const src = decls.get("src")
    if (!family || !src) continue
    const urlMatch = /url\(\s*(['"]?)([^'")]+)\1\s*\)(?:\s*format\(\s*['"]?([^'")]+)['"]?\s*\))?/i.exec(src)
    if (!urlMatch || urlMatch[2].startsWith("data:")) continue
    const url = resolveUrl(urlMatch[2], baseUrl)
    if (!url) continue
    faces.push({
      family: unquote(family),
      style: (decls.get("font-style") ?? "normal").toLowerCase(),
      weight: (decls.get("font-weight") ?? "400").toLowerCase(),
      unicodeRange: decls.get("unicode-range") ?? null,
      url,
      format: urlMatch[3]?.toLowerCase() ?? null,
    })
  }
  return faces
}

type CodeRange = [number, number]

function parseUnicodeRange(range: string): CodeRange[] {
  const ranges: CodeRange[] = []
  for (const raw of range.split(",")) {
    const token = raw.trim().replace(/^u\+/i, "")
    if (!token) continue
    if (token.includes("?")) {
      const lo = Number.parseInt(token.replace(/\?/g, "0"), 16)
      const hi = Number.parseInt(token.replace(/\?/g, "F"), 16)
      if (Number.isFinite(lo) && Number.isFinite(hi)) ranges.push([lo, hi])
      continue
    }
    const [start, end] = token.split("-")
    const lo = Number.parseInt(start, 16)
    const hi = end === undefined ? lo : Number.parseInt(end, 16)
    if (Number.isFinite(lo) && Number.isFinite(hi)) ranges.push([lo, hi])
  }
  return ranges
}

/**
 * Whether a face with this `unicode-range` draws at least one character of
 * `text` (whitespace ignored). No range means the face covers everything.
 */
export function unicodeRangeCovers(range: string | null, text: string): boolean {
  if (range === null || range.trim() === "") return true
  const ranges = parseUnicodeRange(range)
  if (ranges.length === 0) return true
  for (const ch of text) {
    if (/\s/.test(ch)) continue
    const code = ch.codePointAt(0) as number
    if (ranges.some(([lo, hi]) => code >= lo && code <= hi)) return true
  }
  return false
}

function weightNumber(token: string): number | null {
  if (token === "normal") return 400
  if (token === "bold") return 700
  const n = Number(token)
  return Number.isFinite(n) ? n : null
}

/** Whether a face's `font-weight` (one value, or a variable `min max` range) includes `weight`. */
export function fontWeightIncludes(faceWeight: string, weight: number): boolean {
  const parts = faceWeight.trim().split(/\s+/).map(weightNumber)
  if (parts.length === 0 || parts.some((p) => p === null)) return false
  const lo = parts[0] as number
  const hi = (parts[1] ?? lo) as number
  return weight >= Math.min(lo, hi) && weight <= Math.max(lo, hi)
}

/**
 * The faces of `family` an export of `text` needs: upright style, a weight in
 * `weights`, and a `unicode-range` covering the text. Duplicate URLs (the same
 * file listed twice) are kept once.
 */
export function pickFontFaces(
  faces: readonly FontFaceSource[],
  family: string,
  text: string,
  weights: readonly number[] = [400],
): FontFaceSource[] {
  const wanted = family.toLowerCase()
  const seen = new Set<string>()
  const picked: FontFaceSource[] = []
  for (const face of faces) {
    if (face.family.toLowerCase() !== wanted) continue
    if (face.style !== "normal") continue
    if (!weights.some((w) => fontWeightIncludes(face.weight, w))) continue
    if (!unicodeRangeCovers(face.unicodeRange, text)) continue
    if (seen.has(face.url)) continue
    seen.add(face.url)
    picked.push(face)
  }
  return picked
}

/** The parts of a `CSSStyleSheet` the collector reads (so tests can pass plain objects). */
export type StyleSheetLike = {
  href: string | null
  readonly cssRules?: ArrayLike<{ cssText: string }>
}

/**
 * Every `@font-face` rule reachable from `sheets`. A sheet whose rules can be
 * read is parsed from them; a cross-origin sheet (reading its rules throws) is
 * fetched by its `href` with `fetchText`. A sheet that can be neither read nor
 * fetched is skipped.
 */
export async function collectFontFaces(
  sheets: Iterable<StyleSheetLike>,
  fetchText: (url: string) => Promise<string>,
  baseUrl?: string,
): Promise<FontFaceSource[]> {
  const faces: FontFaceSource[] = []
  for (const sheet of sheets) {
    const sheetUrl = sheet.href ?? baseUrl
    let rules: ArrayLike<{ cssText: string }> | undefined
    try {
      rules = sheet.cssRules
    } catch {
      rules = undefined
    }
    if (rules) {
      const css = Array.from(rules, (rule) => rule.cssText).join("\n")
      faces.push(...parseFontFaceRules(css, sheetUrl))
      continue
    }
    if (!sheet.href || !/^https?:/i.test(sheet.href)) continue
    try {
      faces.push(...parseFontFaceRules(await fetchText(sheet.href), sheet.href))
    } catch {
      // Unreachable stylesheet: nothing to embed from it.
    }
  }
  return faces
}

function fontMimeType(face: FontFaceSource): string {
  const hint = face.format ?? /\.(woff2|woff|ttf|otf)(?:[?#]|$)/i.exec(face.url)?.[1]?.toLowerCase() ?? ""
  switch (hint) {
    case "woff2":
      return "font/woff2"
    case "woff":
      return "font/woff"
    case "truetype":
    case "ttf":
      return "font/ttf"
    case "opentype":
    case "otf":
      return "font/otf"
    default:
      return "application/octet-stream"
  }
}

function formatHint(mime: string): string {
  switch (mime) {
    case "font/woff2":
      return ' format("woff2")'
    case "font/woff":
      return ' format("woff")'
    case "font/ttf":
      return ' format("truetype")'
    case "font/otf":
      return ' format("opentype")'
    default:
      return ""
  }
}

/** Base64 of raw bytes, chunked so a large font does not overflow the call stack. */
export function bytesToBase64(bytes: Uint8Array): string {
  let binary = ""
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
  }
  return btoa(binary)
}

function cssString(value: string): string {
  return `"${value.replace(/["\\]/g, "\\$&")}"`
}

/**
 * `@font-face` rules for `faces` with each file inlined as a `data:` URL. A
 * face whose file fails to fetch, or that would push the total past
 * `maxBytes`, is left out.
 */
export async function buildEmbeddedFontCss(
  faces: readonly FontFaceSource[],
  fetchBytes: (url: string) => Promise<ArrayBuffer>,
  maxBytes: number = MAX_EMBEDDED_FONT_BYTES,
): Promise<string> {
  const rules: string[] = []
  let total = 0
  for (const face of faces) {
    let bytes: Uint8Array
    try {
      bytes = new Uint8Array(await fetchBytes(face.url))
    } catch {
      continue
    }
    if (bytes.byteLength === 0 || total + bytes.byteLength > maxBytes) continue
    total += bytes.byteLength
    const mime = fontMimeType(face)
    const range = face.unicodeRange ? `unicode-range:${face.unicodeRange};` : ""
    rules.push(
      `@font-face{font-family:${cssString(face.family)};font-style:${face.style};font-weight:${face.weight};` +
        `${range}src:url(data:${mime};base64,${bytesToBase64(bytes)})${formatHint(mime)};}`,
    )
  }
  return rules.join("\n")
}

/** Injectable environment for {@link resolveArgumentMapExportFont}; every field defaults to the browser's. */
export type ExportFontDeps = {
  /** The page's computed `font-family` for the chart. */
  fontFamilyOf?: (el: Element) => string
  sheets?: Iterable<StyleSheetLike>
  fetchText?: (url: string) => Promise<string>
  fetchBytes?: (url: string) => Promise<ArrayBuffer>
  maxBytes?: number
}

/** The weights the map's text is drawn in: 400, plus any explicit `font-weight` attribute. */
function usedWeights(svg: Element): number[] {
  const weights = new Set<number>([400])
  for (const el of Array.from(svg.querySelectorAll("[font-weight]"))) {
    const n = weightNumber((el.getAttribute("font-weight") ?? "").trim().toLowerCase())
    if (n !== null) weights.add(n)
  }
  return [...weights]
}

async function fetchOk(url: string): Promise<Response> {
  const response = await fetch(url, { mode: "cors", credentials: "omit" })
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  return response
}

/**
 * The font an export of the rendered chart `svg` should name and embed. Never
 * rejects: any failure yields the fallback stack (or the page stack) with no
 * embedded faces.
 */
export async function resolveArgumentMapExportFont(
  svg: Element,
  deps: ExportFontDeps = {},
): Promise<ArgumentMapExportFont> {
  let pageFamily = ""
  try {
    pageFamily = deps.fontFamilyOf
      ? deps.fontFamilyOf(svg)
      : (svg.ownerDocument.defaultView?.getComputedStyle(svg).fontFamily ?? "")
  } catch {
    pageFamily = ""
  }
  const fontFamily = exportFontStack(pageFamily)
  const family = fontFamily === ARGUMENT_MAP_FALLBACK_FONT_STACK ? null : primaryFontFamily(pageFamily)
  if (!family) return { fontFamily, fontFaceCss: "" }

  try {
    const doc = svg.ownerDocument
    const sheets = deps.sheets ?? (Array.from(doc.styleSheets) as unknown as StyleSheetLike[])
    const fetchText = deps.fetchText ?? (async (url: string) => (await fetchOk(url)).text())
    const fetchBytes = deps.fetchBytes ?? (async (url: string) => (await fetchOk(url)).arrayBuffer())
    const faces = await collectFontFaces(sheets, fetchText, doc.baseURI)
    const picked = pickFontFaces(faces, family, svg.textContent ?? "", usedWeights(svg))
    const fontFaceCss = await buildEmbeddedFontCss(picked, fetchBytes, deps.maxBytes)
    return { fontFamily, fontFaceCss }
  } catch {
    return { fontFamily, fontFaceCss: "" }
  }
}
