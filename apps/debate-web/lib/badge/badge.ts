/**
 * `/api/badge` — a small, self-contained SVG badge (label on the left, value on
 * the right), for embedding document stats such as "Words: 1250" in Markdown
 * or `<img>` tags. The value is whatever the caller puts in the URL; nothing is
 * looked up.
 *
 *   /api/badge?label=Words&number=1250
 *   /api/badge?label=Downloads&value=1.2k&color=%23159af0&colorDark=%230864ce
 *
 * Known labels (case-insensitive) pick a preset colour; anything else is blue
 * unless `color` / `colorDark` are given as hex values.
 */

export type BadgeColors = {
  color: string
  colorDark: string
}

export type BadgeOptions = {
  label: string
  value?: string | number
  color?: string
  colorDark?: string
}

export const DEFAULT_BADGE_COLORS: BadgeColors = {
  color: "#159af0",
  colorDark: "#0864ce",
}

export const BADGE_STYLES: Record<string, BadgeColors> = {
  words: DEFAULT_BADGE_COLORS,
  pages: { color: "#a52bf0", colorDark: "#6d13bd" },
  figures: { color: "#54df13", colorDark: "#239b08" },
  cites: { color: "#ff9e0a", colorDark: "#e76a00" },
  "cited by": { color: "#12c5c5", colorDark: "#078b9a" },
  "refs / refdoc": { color: "#8ddc12", colorDark: "#399b09" },
}

export const MAX_LABEL_LENGTH = 80
export const MAX_VALUE_LENGTH = 40

const XML_ENTITIES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&apos;",
}

export function escapeXml(input: string | number): string {
  return String(input).replace(/[&<>"']/g, (character) => XML_ENTITIES[character]!)
}

export function isHexColor(value: string): boolean {
  return /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(value)
}

/** Return a self-contained, transparent, 20px-high SVG badge. */
export function createBadgeSvg({
  label,
  value = "",
  color = DEFAULT_BADGE_COLORS.color,
  colorDark = DEFAULT_BADGE_COLORS.colorDark,
}: BadgeOptions): string {
  // Each response is a standalone SVG, so fixed internal IDs are sufficient.
  const id = "citation-badge"
  const safeLabel = escapeXml(label)
  const safeValue = escapeXml(value)
  const hasValue = String(value) !== ""

  const labelWidth = Math.max(30, Math.ceil(label.length * 4.9 + 16))
  const valueWidth = hasValue ? Math.max(22, Math.ceil(String(value).length * 4.9 + 16)) : 0
  const width = labelWidth + valueWidth

  const accessibleLabel = escapeXml(hasValue ? `${label}: ${value}` : label)

  return `<svg xmlns="http://www.w3.org/2000/svg"
  width="${width}" height="20" viewBox="0 0 ${width} 20"
  role="img" aria-label="${accessibleLabel}">
  <title>${accessibleLabel}</title>
  <defs>
    <linearGradient id="${id}-label" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${escapeXml(color)}"/>
      <stop offset="1" stop-color="${escapeXml(colorDark)}"/>
    </linearGradient>
    <linearGradient id="${id}-body" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#35383c"/>
      <stop offset="1" stop-color="#202327"/>
    </linearGradient>
    <linearGradient id="${id}-gloss" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#fff" stop-opacity=".16"/>
      <stop offset=".5" stop-color="#fff" stop-opacity=".02"/>
      <stop offset="1" stop-color="#000" stop-opacity=".08"/>
    </linearGradient>
    <clipPath id="${id}-clip">
      <rect x=".5" y=".5" width="${width - 1}" height="19" rx="5.5"/>
    </clipPath>
  </defs>
  <rect x=".5" y=".5" width="${width - 1}" height="19" rx="5.5"
    fill="url(#${id}-body)" stroke="#111417" stroke-width=".7"/>
  <g clip-path="url(#${id}-clip)">
    <rect x=".5" y=".5" width="${labelWidth}" height="19"
      fill="url(#${id}-label)"/>
  </g>
  <rect x=".5" y=".5" width="${width - 1}" height="19" rx="5.5"
    fill="url(#${id}-gloss)" stroke="#fff" stroke-opacity=".12"
    stroke-width=".45"/>
  <text x="${labelWidth / 2}" y="13.15" text-anchor="middle"
    font-family="Arial, Helvetica, sans-serif" font-size="8.2"
    font-weight="700" fill="#fff">${safeLabel}</text>
  ${
    hasValue
      ? `<text x="${labelWidth + valueWidth / 2}" y="13.15"
    text-anchor="middle" font-family="Arial, Helvetica, sans-serif"
    font-size="8.2" font-weight="600" fill="#f7f8fa">${safeValue}</text>`
      : ""
  }
</svg>`
}

function badRequest(message: string): Response {
  return Response.json({ error: message }, { status: 400, headers: { "Cache-Control": "no-store" } })
}

/** Handle `GET /api/badge`: read the query string and answer with the SVG. */
export function handleBadgeRequest(request: Request): Response {
  const params = new URL(request.url).searchParams

  const label = params.get("label")?.trim() ?? ""
  // Support both ?number=1250 and ?value=1250.
  const value = (params.get("number") ?? params.get("value") ?? "").trim()

  if (!label) return badRequest('The "label" query parameter is required.')
  if (label.length > MAX_LABEL_LENGTH) {
    return badRequest(`The "label" parameter must be ${MAX_LABEL_LENGTH} characters or fewer.`)
  }
  if (value.length > MAX_VALUE_LENGTH) {
    return badRequest(`The "number" or "value" parameter must be ${MAX_VALUE_LENGTH} characters or fewer.`)
  }

  const styleKey = label.toLowerCase()
  const preset = Object.hasOwn(BADGE_STYLES, styleKey) ? BADGE_STYLES[styleKey]! : DEFAULT_BADGE_COLORS
  const color = params.get("color") ?? preset.color
  const colorDark = params.get("colorDark") ?? preset.colorDark

  if (!isHexColor(color) || !isHexColor(colorDark)) {
    return badRequest('Colors must be hex values such as "#159af0" or "#09f".')
  }

  return new Response(createBadgeSvg({ label, value, color, colorDark }), {
    status: 200,
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox",
    },
  })
}
