/**
 * @fileoverview The signposting of a speech — its H1 and H2 heading names
 * (pockets and hats), in document order, without the H3 blocks or the H4
 * tags that hold each card's long sentence summary.
 *
 * Accepts both speech doc shapes: Debate Editor HTML (a linked editor document,
 * `<h1>`/`<h2>` or `.pmd-pocket|hat`) and a flow's own markdown
 * (`#`/`##`). Pure and DOM-free so it runs in the `node` test environment.
 *
 * @module utils/speech-signposts
 */

import { looksLikeHtml } from "@debate/timer/src/formats/speech-doc-word-stats"
import { extractSpeechDocHeadings, type SpeechDocHeading } from "./speech-doc-headings"

/** Deepest heading level shown — H3 blocks and H4 card tags are too fine for a signpost. */
export const SIGNPOST_MAX_LEVEL = 2

const CLASS_LEVELS: Record<string, number> = { "pmd-pocket": 1, "pmd-hat": 2, "pmd-block": 3 }

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

function headingLevel(tag: string, attrs: string): number | null {
  const h = /^h([1-6])$/i.exec(tag)
  if (h) return Number(h[1])
  const cls = /\bclass\s*=\s*["']([^"']*)["']/i.exec(attrs)?.[1] ?? ""
  for (const name of cls.split(/\s+/)) {
    if (CLASS_LEVELS[name]) return CLASS_LEVELS[name]
  }
  return null
}

function htmlSignposts(html: string): SpeechDocHeading[] {
  const headings: SpeechDocHeading[] = []
  const block = /<(h[1-6]|p|div)\b([^>]*)>([\s\S]*?)<\/\1>/gi
  let match: RegExpExecArray | null
  while ((match = block.exec(html)) !== null) {
    const [raw, tag, attrs, inner] = match
    const level = headingLevel(tag, attrs)
    if (level == null || level > SIGNPOST_MAX_LEVEL) continue
    const text = decodeEntities(inner.replace(/<[^>]*>/g, "")).replace(/\s+/g, " ").trim()
    if (text) headings.push({ level, text, raw })
  }
  return headings
}

/** The H1 and H2 headings of a speech doc, in order. Empty when it has none. */
export function extractSpeechSignposts(content: string | null | undefined): SpeechDocHeading[] {
  if (!content || !content.trim()) return []
  if (looksLikeHtml(content)) return htmlSignposts(content)
  return extractSpeechDocHeadings(content, { depth: SIGNPOST_MAX_LEVEL }).filter((h) => h.text)
}
