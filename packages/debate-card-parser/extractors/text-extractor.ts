/** @fileoverview Utilities for extracting highlighted/underlined segments from card HTML. */

function stripTags(html: string): string {
  return html.replace(/<[^>]+>/g, "")
}

function extractTagContent(htmlBody: string, tag: string): string[] {
  if (!htmlBody) return []
  const result: string[] = []
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "gi")
  let m: RegExpExecArray | null
  while ((m = re.exec(htmlBody)) !== null) {
    const text = stripTags(m[1]).replace(/\s+/g, " ").trim()
    if (text) result.push(text)
  }
  return result
}

/**
 * Extracts concatenated highlighted (`<mark>`) text from HTML.
 */
export function extractMarked(htmlBody: string, useEllipsis = true): string {
  return extractTagContent(htmlBody, "mark").join(useEllipsis ? "…" : " ")
}

/**
 * Extracts each underlined (`<u>`) segment from HTML.
 */
export function extractUnderlined(htmlBody: string): string[] {
  return extractTagContent(htmlBody, "u")
}
