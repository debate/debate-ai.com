/**
 * @fileoverview Word statistics for a speech document — how many words a
 * speaker reads, how many are underlined, how many are highlighted — so the
 * timer bar can show a debater what their speech doc adds up to, alongside
 * how many words they actually spoke (see `recorder/spoken-words-store.ts`).
 *
 * Accepts either of the two shapes a speech doc takes in this app:
 *
 * - **CardMirror HTML** (a linked editor document): highlights are
 *   `span.pmd-highlight` (or `<mark>`), underlines are `span.pmd-underline`,
 *   `span.pmd-emphasis` or `<u>`, and tags/analytics/headings are
 *   `.pmd-tag` / `.pmd-analytic` / `.pmd-pocket|hat|block` / `<h1–6>`.
 * - **Markdown** (a flow's own `speechDocs` text): `==highlight==`,
 *   `**bold**` (read aloud, like highlighting), `<u>underline</u>` and
 *   `#` headings, converted to the same HTML shape before counting.
 *
 * "Read" is what a speaker says aloud from the doc: every word of a tag,
 * analytic or heading, plus the highlighted words of card text. When a doc
 * has no highlighting at all (plain analytics / a typed speech) every word
 * counts as read.
 *
 * Pure and DOM-free (a small tag-stack walker rather than `DOMParser`) so it
 * runs in this package's `node` Vitest environment and on the server.
 *
 * @module formats/speech-doc-word-stats
 */

export interface SpeechDocWordStats {
  /** Every word in the document. */
  total: number
  /** Words a speaker reads aloud — tags/analytics/headings plus highlighted card text. */
  read: number
  /** Underlined (or emphasized) words. */
  underlined: number
  /** Highlighted words. */
  highlighted: number
}

export const EMPTY_SPEECH_DOC_WORD_STATS: SpeechDocWordStats = {
  total: 0,
  read: 0,
  underlined: 0,
  highlighted: 0,
}

/**
 * Whether `content` is HTML (a CardMirror document) rather than markdown.
 * Markdown may carry inline tags (`<u>`, `<mark>`), so only block-level
 * markup marks a document as HTML.
 */
export function looksLikeHtml(content: string): boolean {
  return /<(p|div|h[1-6]|li|ul|ol|table|blockquote|section)\b[^>]*>/i.test(content)
}

/**
 * Converts the markdown subset a flow speech doc uses into the HTML shape
 * {@link computeSpeechDocWordStats} counts. Inline `<mark>`/`<u>`/`<b>` tags
 * already present in the markdown pass through.
 */
export function speechMarkdownToHtml(markdown: string): string {
  return markdown
    .split(/\r?\n/)
    .map((line) => {
      const heading = /^\s*(#{1,6})\s+(.*)$/.exec(line)
      const body = heading ? heading[2] : line
      const inline = body
        // Keep author-written inline tags; only escape stray angle brackets.
        .replace(/<(?!\/?(mark|u|b|strong|em|i)\b)/gi, "&lt;")
        .replace(/==(.+?)==/g, "<mark>$1</mark>")
        .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
        .replace(/__(.+?)__/g, "<strong>$1</strong>")
      if (heading) return `<h${heading[1].length}>${inline}</h${heading[1].length}>`
      return inline.trim() ? `<p>${inline}</p>` : ""
    })
    .join("\n")
}

type Frame = {
  tag: string
  highlight: boolean
  underline: boolean
  bold: boolean
  readBlock: boolean
}

const VOID_TAGS = new Set(["br", "hr", "img", "input", "meta", "link", "wbr", "col", "source"])
const BLOCK_BREAK_TAGS = new Set([
  "p", "div", "li", "ul", "ol", "tr", "td", "th", "table", "section", "article",
  "h1", "h2", "h3", "h4", "h5", "h6", "br", "blockquote",
])

function attr(attrs: string, name: string): string {
  const match = new RegExp(`\\b${name}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s>]+))`, "i").exec(attrs)
  return match ? (match[2] ?? match[3] ?? match[4] ?? "") : ""
}

function classifyTag(tag: string, attrs: string): Omit<Frame, "tag"> {
  const cls = ` ${attr(attrs, "class")} `
  const has = (name: string) => cls.includes(` ${name} `)
  const style = attr(attrs, "style").toLowerCase()
  const highlightAttr = attr(attrs, "data-highlight").toLowerCase()
  return {
    highlight:
      tag === "mark" ||
      (has("pmd-highlight") && highlightAttr !== "none") ||
      /background(-color)?\s*:\s*(yellow|#?ffff00|lime|#?00ff00|cyan|#?00ffff)/.test(style),
    underline: tag === "u" || has("pmd-underline") || has("pmd-emphasis") || /text-decoration[^;]*underline/.test(style),
    bold: tag === "strong" || tag === "b",
    readBlock:
      /^h[1-6]$/.test(tag) ||
      has("pmd-tag") ||
      has("pmd-analytic") ||
      has("pmd-pocket") ||
      has("pmd-hat") ||
      has("pmd-block"),
  }
}

function decodeEntities(text: string): string {
  return text
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
}

type Run = { text: string; highlight: boolean; underline: boolean; bold: boolean; readBlock: boolean; breakBefore: boolean }

/**
 * Walks the HTML into flat text runs, each carrying the formatting in effect
 * where it sits. Runs separated by a block boundary never join into one word.
 */
function htmlRuns(html: string): Run[] {
  const runs: Run[] = []
  const stack: Frame[] = []
  const token = /<!--[\s\S]*?-->|<(\/?)([a-zA-Z][a-zA-Z0-9-]*)([^>]*)>|([^<]+)/g
  let pendingBreak = false
  let match: RegExpExecArray | null
  while ((match = token.exec(html)) !== null) {
    const [, closing, rawTag, attrs, text] = match
    if (text !== undefined) {
      const decoded = decodeEntities(text)
      if (!decoded) continue
      runs.push({
        text: decoded,
        highlight: stack.some((f) => f.highlight),
        underline: stack.some((f) => f.underline),
        bold: stack.some((f) => f.bold),
        readBlock: stack.some((f) => f.readBlock),
        breakBefore: pendingBreak,
      })
      pendingBreak = false
      continue
    }
    if (!rawTag) continue
    const tag = rawTag.toLowerCase()
    if (BLOCK_BREAK_TAGS.has(tag)) pendingBreak = true
    if (closing) {
      const at = stack.map((f) => f.tag).lastIndexOf(tag)
      if (at !== -1) stack.length = at
      continue
    }
    if (VOID_TAGS.has(tag) || attrs.trim().endsWith("/")) continue
    stack.push({ tag, ...classifyTag(tag, attrs) })
  }
  return runs
}

/**
 * Counts total / read / underlined / highlighted words in a speech doc.
 * A word split across formatting runs (half-highlighted) counts once, with
 * the formatting of its first character — matching how a reader would
 * judge "is this word highlighted".
 */
export function computeSpeechDocWordStats(content: string | null | undefined): SpeechDocWordStats {
  if (!content || !content.trim()) return { ...EMPTY_SPEECH_DOC_WORD_STATS }
  const html = looksLikeHtml(content) ? content : speechMarkdownToHtml(content)

  type Word = { text: string; highlight: boolean; underline: boolean; bold: boolean; readBlock: boolean }
  const words: Word[] = []
  let current: Word | null = null
  for (const run of htmlRuns(html)) {
    if (run.breakBefore) current = null
    for (const char of run.text) {
      if (/\s/.test(char)) {
        current = null
      } else if (current) {
        current.text += char
      } else {
        current = { text: char, highlight: run.highlight, underline: run.underline, bold: run.bold, readBlock: run.readBlock }
        words.push(current)
      }
    }
  }

  // Punctuation on its own (a stray "—" or "…") isn't a word.
  const counted = words.filter((w) => /[\p{L}\p{N}]/u.test(w.text))
  const marked = (w: Word) => w.highlight || w.bold
  const anyMarked = counted.some((w) => marked(w) && !w.readBlock)

  const stats = { ...EMPTY_SPEECH_DOC_WORD_STATS, total: counted.length }
  for (const word of counted) {
    if (word.highlight) stats.highlighted += 1
    if (word.underline) stats.underlined += 1
    if (!anyMarked || word.readBlock || marked(word)) stats.read += 1
  }
  return stats
}
