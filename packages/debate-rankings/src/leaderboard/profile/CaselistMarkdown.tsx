/**
 * @fileoverview Renders openCaselist cite text — markdown written in the
 * caselist's cite editor — as React elements, without `innerHTML`. Covers what
 * cite entries actually use: `#` headings, `**bold**`, `*italic*` / `_italic_`,
 * `[text](url)` links, bare URLs and paragraphs; anything else stays text.
 * @module leaderboard/profile/CaselistMarkdown
 */

import type { ReactNode } from "react"

const INLINE = /(\*\*[^*]+\*\*|__[^_]+__|\*[^*\s][^*]*\*|_[^_\s][^_]*_|\[[^\]]+\]\([^)\s]+\)|https?:\/\/[^\s<>()]+)/g

function safeHref(url: string): string | null {
  try {
    const parsed = new URL(url)
    return parsed.protocol === "https:" || parsed.protocol === "http:" ? parsed.toString() : null
  } catch {
    return null
  }
}

/** Inline markdown → React nodes. */
export function renderInline(text: string, keyPrefix = "i"): ReactNode[] {
  const nodes: ReactNode[] = []
  let last = 0
  let index = 0
  for (const match of text.matchAll(INLINE)) {
    const token = match[0]
    const start = match.index ?? 0
    if (start > last) nodes.push(text.slice(last, start))
    const key = `${keyPrefix}-${index++}`
    if (token.startsWith("**") || token.startsWith("__")) {
      nodes.push(<strong key={key}>{token.slice(2, -2)}</strong>)
    } else if (token.startsWith("[")) {
      const [, label, url] = token.match(/^\[([^\]]+)\]\(([^)\s]+)\)$/) ?? []
      const href = url ? safeHref(url) : null
      nodes.push(
        href ? (
          <a key={key} href={href} target="_blank" rel="noopener noreferrer nofollow" className="underline">
            {label}
          </a>
        ) : (
          label ?? token
        ),
      )
    } else if (token.startsWith("http")) {
      const href = safeHref(token)
      nodes.push(
        href ? (
          <a key={key} href={href} target="_blank" rel="noopener noreferrer nofollow" className="break-all underline">
            {token}
          </a>
        ) : (
          token
        ),
      )
    } else {
      nodes.push(<em key={key}>{token.slice(1, -1)}</em>)
    }
    last = start + token.length
  }
  if (last < text.length) nodes.push(text.slice(last))
  return nodes
}

/** Block-level cite markdown → headings and paragraphs. */
export function CaselistMarkdown({ text }: { text: string }) {
  const blocks: ReactNode[] = []
  let paragraph: string[] = []
  const flush = () => {
    if (paragraph.length === 0) return
    const key = `p-${blocks.length}`
    blocks.push(
      <p key={key} className="whitespace-pre-wrap break-words">
        {renderInline(paragraph.join("\n"), key)}
      </p>,
    )
    paragraph = []
  }
  for (const raw of text.replace(/\r\n?/g, "\n").split("\n")) {
    const line = raw.trimEnd()
    const heading = line.match(/^(#{1,6})\s+(.*)$/)
    if (heading) {
      flush()
      const key = `h-${blocks.length}`
      blocks.push(
        <p key={key} className={heading[1].length <= 2 ? "font-semibold" : "font-medium"}>
          {renderInline(heading[2], key)}
        </p>,
      )
    } else if (!line.trim()) {
      flush()
    } else {
      paragraph.push(line)
    }
  }
  flush()
  return <div className="space-y-2 text-sm leading-relaxed">{blocks}</div>
}
