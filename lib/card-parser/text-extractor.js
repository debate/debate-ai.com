/**
 * @fileoverview Text extraction utilities for debate cards.
 * Extracts marked (highlighted) and underlined text from HTML content.
 * @module card-parser/text-extractor
 */

import { Parser } from "htmlparser2"

/**
 * Extracts text content from <mark> tags in HTML.
 * Used to extract highlighted/emphasized portions of debate evidence.
 *
 * @param {string} htmlBody - HTML string containing mark tags
 * @param {boolean} [useEllipsis=true] - Whether to join segments with ellipsis (…) or space
 * @returns {string} Extracted marked text, joined by ellipsis or space
 *
 * @example
 * const marked = extractMarked('<p>Normal text <mark>highlighted</mark> more text</p>');
 * // Returns "highlighted"
 *
 * @example
 * const marked = extractMarked('<p><mark>First</mark> gap <mark>Second</mark></p>', true);
 * // Returns "First…Second"
 */
export function extractMarked(htmlBody, useEllipsis = true) {
  const marked = []

  if (!htmlBody) return marked

  let insideMark = false
  let currentText = ""

  const parser = new Parser(
    {
      /**
       * @param {string} name - Tag name
       */
      onopentag(name) {
        if (name === "mark") {
          insideMark = true
          currentText = ""
        }
      },

      /**
       * @param {string} text - Text content
       */
      ontext(text) {
        if (insideMark) {
          currentText += text
        }
      },

      /**
       * @param {string} name - Tag name
       */
      onclosetag(name) {
        if (name === "mark" && insideMark) {
          const cleanText = currentText.replace(/\s+/g, " ").trim()
          if (cleanText) {
            marked.push(cleanText)
          }
          insideMark = false
          currentText = ""
        }
      },
    },
    {
      decodeEntities: true,
      lowerCaseTags: true,
    },
  )

  parser.write(htmlBody)
  parser.end()

  return marked.join(useEllipsis ? "…" : " ")
}

/**
 * Extracts text content from <u> (underline) tags in HTML.
 * Used to extract underlined portions of debate evidence.
 *
 * @param {string} htmlBody - HTML string containing underline tags
 * @returns {string[]} Array of underlined text segments
 *
 * @example
 * const underlined = extractUnderlined('<p>Normal text <u>underlined</u> more text</p>');
 * // Returns ["underlined"]
 */
export function extractUnderlined(htmlBody) {
  const underlined = []

  if (!htmlBody) return underlined

  let insideU = false
  let currentText = ""

  const parser = new Parser(
    {
      /**
       * @param {string} name - Tag name
       */
      onopentag(name) {
        if (name === "u") {
          insideU = true
          currentText = ""
        }
      },

      /**
       * @param {string} text - Text content
       */
      ontext(text) {
        if (insideU) {
          currentText += text
        }
      },

      /**
       * @param {string} name - Tag name
       */
      onclosetag(name) {
        if (name === "u" && insideU) {
          const cleanText = currentText.replace(/\s+/g, " ").trim()
          if (cleanText) {
            underlined.push(cleanText)
          }
          insideU = false
          currentText = ""
        }
      },
    },
    {
      decodeEntities: true,
      lowerCaseTags: true,
    },
  )

  parser.write(htmlBody)
  parser.end()

  return underlined
}
