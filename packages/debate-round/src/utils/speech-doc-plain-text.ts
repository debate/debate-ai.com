/**
 * @fileoverview Plain text of a speech doc, for text analysis such as fallacy
 * hints. Accepts both speech doc shapes (Debate Editor HTML and a flow's
 * markdown). HTML tags are dropped and block boundaries become sentence
 * breaks so a heading never fuses with the paragraph after it. Pure and
 * DOM-free so it runs in the `node` test environment.
 *
 * @module utils/speech-doc-plain-text
 */

import { looksLikeHtml } from "@debate-ai/timer/src/formats/speech-doc-word-stats"

const BLOCK_END = /<\/(?:p|div|li|h[1-6]|blockquote|tr)>|<br\s*\/?>/gi

function decodeEntities(text: string): string {
  return text
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&amp;/g, "&")
}

export function speechDocPlainText(content: string | null | undefined): string {
  if (!content) return ""
  if (!looksLikeHtml(content)) {
    return content.replace(/^#{1,6}\s+/gm, "").replace(/[*_`]/g, "").trim()
  }
  return decodeEntities(
    content
      .replace(/<(script|style)[\s\S]*?<\/\1>/gi, "")
      .replace(BLOCK_END, ". ")
      .replace(/<[^>]+>/g, ""),
  )
    .replace(/\s+/g, " ")
    .replace(/(?:\.\s*){2,}/g, ". ")
    .trim()
}
