/** @fileoverview Utilities for extracting highlighted/underlined segments from card HTML. */
import { Parser } from "htmlparser2"

/**
 * Extracts concatenated highlighted (`<mark>`) text from HTML.
 *
 * @param htmlBody - HTML fragment to scan.
 * @param useEllipsis - Joins extracted segments with an ellipsis when true.
 * @returns Highlighted text segments joined into a single string.
 */
export function extractMarked(htmlBody: string, useEllipsis = true): string {
  const marked: string[] = []
  if (!htmlBody) return ""

  let insideMark = false
  let currentText = ""

  const parser = new Parser(
    {
      onopentag(name: string) {
        // Start capturing text only while inside a <mark> region.
        if (name === "mark") {
          insideMark = true
          currentText = ""
        }
      },
      ontext(text: string) {
        // Preserve text order as it appears inside marked spans.
        if (insideMark) currentText += text
      },
      onclosetag(name: string) {
        if (name === "mark" && insideMark) {
          // Normalize whitespace to avoid double spaces from nested markup.
          const cleanText = currentText.replace(/\s+/g, " ").trim()
          if (cleanText) marked.push(cleanText)
          insideMark = false
          currentText = ""
        }
      },
    },
    { decodeEntities: true, lowerCaseTags: true },
  )

  parser.write(htmlBody)
  parser.end()

  return marked.join(useEllipsis ? "…" : " ")
}

/**
 * Extracts each underlined (`<u>`) segment from HTML.
 *
 * @param htmlBody - HTML fragment to scan.
 * @returns Ordered list of normalized underlined text segments.
 */
export function extractUnderlined(htmlBody: string): string[] {
  const underlined: string[] = []
  if (!htmlBody) return underlined

  let insideU = false
  let currentText = ""

  const parser = new Parser(
    {
      onopentag(name: string) {
        // Start capturing text only while inside a <u> region.
        if (name === "u") {
          insideU = true
          currentText = ""
        }
      },
      ontext(text: string) {
        // Preserve text order as it appears inside underlined spans.
        if (insideU) currentText += text
      },
      onclosetag(name: string) {
        if (name === "u" && insideU) {
          // Normalize whitespace to keep returned segments display-ready.
          const cleanText = currentText.replace(/\s+/g, " ").trim()
          if (cleanText) underlined.push(cleanText)
          insideU = false
          currentText = ""
        }
      },
    },
    { decodeEntities: true, lowerCaseTags: true },
  )

  parser.write(htmlBody)
  parser.end()

  return underlined
}
