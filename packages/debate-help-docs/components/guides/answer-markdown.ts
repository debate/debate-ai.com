/**
 * @file answer-markdown.ts
 * @description Renders a suggested-question answer's Markdown to HTML.
 *
 * Answers come from the AI and, once saved, from the database for every
 * reader, so the renderer is locked down rather than trusted (the same rules
 * as the video documents' renderer in debate-videos):
 *
 *   - raw HTML in the source is shown as text, never parsed;
 *   - links keep only `http(s)`, `mailto` and same-site paths, and open in a
 *     new tab so a click doesn't leave the page being read;
 *   - images are dropped to their alt text.
 */
import { Marked, type Tokens } from "marked"

const SAFE_URL = /^(https?:|mailto:|\/(?!\/)|#)/i

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

const marked = new Marked({ gfm: true, async: false })

marked.use({
  renderer: {
    html({ text }: Tokens.HTML | Tokens.Tag) {
      return escapeHtml(text)
    },
    link({ href, title, tokens }: Tokens.Link) {
      const label = this.parser.parseInline(tokens)
      const url = (href ?? "").trim()
      if (!SAFE_URL.test(url)) return label
      const titleAttr = title ? ` title="${escapeHtml(title)}"` : ""
      return `<a href="${escapeHtml(url)}"${titleAttr} target="_blank" rel="noopener noreferrer nofollow">${label}</a>`
    },
    image({ text }: Tokens.Image) {
      return escapeHtml(text)
    },
  },
})

/** An answer's Markdown as sanitized HTML. */
export function renderAnswerMarkdown(markdown: string): string {
  return marked.parse(markdown ?? "") as string
}
