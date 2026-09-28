/**
 * @fileoverview Markdown rendering for a video's long-form documents.
 *
 * Summaries and analyses are pasted in as markdown — bold claims, bulleted
 * arguments, the odd link to a card — and read far better rendered than as
 * the raw asterisks. The text comes from editors and from AI models, not from
 * this codebase, so the renderer is locked down rather than trusted:
 *
 *   - raw HTML in the source is shown as text, never parsed;
 *   - links and images keep only `http(s)`/`mailto` URLs, and links open in a
 *     new tab so a click never navigates away from the playing video;
 *   - single newlines are line breaks (`breaks`), because a pasted transcript
 *     relies on them the way the old `whitespace-pre-line` paragraphs did.
 *
 * Search highlighting is applied to the rendered HTML's text only — never
 * inside a tag or an entity — so marking a match cannot break the markup.
 * @module lib/document-markdown
 */

import { Marked, type Tokens } from "marked"

const SAFE_URL = /^(https?:|mailto:)/i

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

function safeUrl(href: string | null | undefined): string | null {
  const trimmed = (href ?? "").trim()
  return SAFE_URL.test(trimmed) ? trimmed : null
}

const marked = new Marked({ gfm: true, breaks: true, async: false })

marked.use({
  renderer: {
    html({ text }: Tokens.HTML | Tokens.Tag) {
      return escapeHtml(text)
    },
    link({ href, title, tokens }: Tokens.Link) {
      const label = this.parser.parseInline(tokens)
      const url = safeUrl(href)
      if (!url) return label
      const titleAttr = title ? ` title="${escapeHtml(title)}"` : ""
      return `<a href="${escapeHtml(url)}"${titleAttr} target="_blank" rel="noopener noreferrer nofollow">${label}</a>`
    },
    image({ href, title, text }: Tokens.Image) {
      const url = safeUrl(href)
      if (!url || !/^https?:/i.test(url)) return escapeHtml(text)
      const titleAttr = title ? ` title="${escapeHtml(title)}"` : ""
      return `<img src="${escapeHtml(url)}" alt="${escapeHtml(text)}"${titleAttr} loading="lazy" />`
    },
  },
})

/** Renders a document's markdown to sanitized HTML. */
export function renderDocumentMarkdown(markdown: string): string {
  return marked.parse(markdown ?? "") as string
}

/**
 * Wraps every case-insensitive occurrence of `needle` in the HTML's text in
 * `<mark>`. Tags and character entities are left alone, so a search for
 * "amp" does not split `&amp;` and a search for "href" does not touch an
 * attribute.
 */
export function highlightHtml(html: string, needle: string): string {
  const term = needle.trim().toLowerCase()
  if (!term) return html
  const escapedTerm = escapeHtml(term)

  return html
    .split(/(<[^>]*>)/)
    .map((part) => {
      if (part.startsWith("<")) return part
      return part
        .split(/(&#?\w+;)/)
        .map((piece) => {
          if (/^&#?\w+;$/.test(piece)) return piece
          const lower = piece.toLowerCase()
          let out = ""
          let index = 0
          for (;;) {
            const found = lower.indexOf(escapedTerm, index)
            if (found === -1) break
            out += piece.slice(index, found)
            out += `<mark>${piece.slice(found, found + escapedTerm.length)}</mark>`
            index = found + escapedTerm.length
          }
          return out + piece.slice(index)
        })
        .join("")
    })
    .join("")
}
