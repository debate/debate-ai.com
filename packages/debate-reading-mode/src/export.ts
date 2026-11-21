/**
 * Exporting what a reader is reading: the text of a page (or a whole loaded
 * section) as Markdown, as a Word document, or as a printable page.
 *
 * Everything here works on rendered HTML, so it exports exactly what the
 * reader sees, highlights and card underlining included, rather than the
 * page's source. The docs' Synergy Slayer pages and their reading mode use
 * it for their Export menu (`components/guides/export-menu.tsx` in
 * `@debate-ai/help-docs`).
 */

/** Elements that are controls or decoration, never part of the text. */
const SKIP_SELECTOR = 'button, svg, script, style, noscript, iframe, input, select, textarea, [data-export-skip], [aria-hidden="true"]'

/**
 * A copy of `root` without its buttons, icons and other non-text parts, ready
 * to serialise. `root` itself is left untouched.
 */
export function exportableClone(root: Element): HTMLElement {
  const clone = root.cloneNode(true) as HTMLElement
  for (const element of Array.from(clone.querySelectorAll(SKIP_SELECTOR))) element.remove()
  return clone
}

/** A file name for `title`: lowercase words joined by hyphens, plus `extension`. */
export function exportFileName(title: string, extension: string): string {
  const base = title
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
  return `${base || 'document'}.${extension}`
}

const BLOCK_TAGS = new Set([
  'ADDRESS', 'ARTICLE', 'ASIDE', 'DIV', 'FIGURE', 'FOOTER', 'HEADER', 'MAIN', 'NAV', 'SECTION', 'DETAILS', 'SUMMARY',
])

/** Escapes characters Markdown would read as formatting. */
function escapeText(text: string): string {
  return text.replace(/([\\`*_[\]])/g, '\\$1')
}

function inlineMarkdown(node: Node): string {
  if (node.nodeType === 3) return escapeText((node.textContent ?? '').replace(/\s+/g, ' '))
  if (node.nodeType !== 1) return ''
  const element = node as HTMLElement
  const inner = () => Array.from(element.childNodes).map(inlineMarkdown).join('')
  const wrap = (marker: string) => {
    const text = inner()
    if (!text.trim()) return text
    // Keep the spaces outside the markers, or Markdown won't read them.
    const lead = text.match(/^\s*/)?.[0] ?? ''
    const trail = text.match(/\s*$/)?.[0] ?? ''
    return `${lead}${marker}${text.trim()}${marker}${trail}`
  }
  switch (element.tagName) {
    case 'STRONG':
    case 'B':
      return wrap('**')
    case 'EM':
    case 'I':
      return wrap('*')
    case 'MARK':
      // The docs' own `==highlight==` syntax (remark-debate-highlight).
      return wrap('==')
    case 'U': {
      const text = inner()
      return text.trim() ? `<u>${text}</u>` : text
    }
    case 'CODE':
      return `\`${element.textContent ?? ''}\``
    case 'BR':
      return '  \n'
    case 'A': {
      const text = inner()
      const href = element.getAttribute('href')
      if (!href || href.startsWith('#') || !text.trim()) return text
      return `[${text}](${absoluteUrl(href)})`
    }
    case 'IMG': {
      const src = element.getAttribute('src')
      return src ? `![${element.getAttribute('alt') ?? ''}](${absoluteUrl(src)})` : ''
    }
    default:
      return inner()
  }
}

function absoluteUrl(href: string): string {
  try {
    return typeof location === 'undefined' ? href : new URL(href, location.href).href
  } catch {
    return href
  }
}

function blockMarkdown(element: Element, listDepth: number): string[] {
  const tag = element.tagName
  const heading = /^H([1-6])$/.exec(tag)
  if (heading) {
    const text = inlineMarkdown(element).trim()
    return text ? [`${'#'.repeat(Number(heading[1]))} ${text}`] : []
  }
  switch (tag) {
    case 'P': {
      const text = inlineMarkdown(element).trim()
      return text ? [text] : []
    }
    case 'HR':
      return ['---']
    case 'PRE':
      return ['```\n' + (element.textContent ?? '').replace(/\n$/, '') + '\n```']
    case 'BLOCKQUOTE':
      return [childBlocks(element, listDepth).join('\n\n').split('\n').map((line) => `> ${line}`.trimEnd()).join('\n')]
    case 'UL':
    case 'OL':
      return [listMarkdown(element, listDepth)]
    case 'TABLE':
      return tableMarkdown(element)
    default:
      if (BLOCK_TAGS.has(tag) || hasBlockChild(element)) return childBlocks(element, listDepth)
      {
        const text = inlineMarkdown(element).trim()
        return text ? [text] : []
      }
  }
}

function hasBlockChild(element: Element): boolean {
  return Array.from(element.children).some((child) =>
    /^(H[1-6]|P|UL|OL|TABLE|PRE|BLOCKQUOTE|HR)$/.test(child.tagName) || BLOCK_TAGS.has(child.tagName),
  )
}

/** Blocks for `element`'s children; loose inline runs become paragraphs. */
function childBlocks(element: Element, listDepth: number): string[] {
  const blocks: string[] = []
  let run = ''
  const flush = () => {
    if (run.trim()) blocks.push(run.trim())
    run = ''
  }
  for (const child of Array.from(element.childNodes)) {
    const isBlock = child.nodeType === 1 && (
      /^(H[1-6]|P|UL|OL|TABLE|PRE|BLOCKQUOTE|HR)$/.test((child as Element).tagName) ||
      BLOCK_TAGS.has((child as Element).tagName) ||
      hasBlockChild(child as Element)
    )
    if (isBlock) {
      flush()
      blocks.push(...blockMarkdown(child as Element, listDepth))
    } else {
      run += inlineMarkdown(child)
    }
  }
  flush()
  return blocks
}

function listMarkdown(list: Element, depth: number): string {
  const ordered = list.tagName === 'OL'
  const indent = '  '.repeat(depth)
  const items = Array.from(list.children).filter((child) => child.tagName === 'LI')
  return items
    .map((item, index) => {
      const marker = ordered ? `${index + 1}.` : '-'
      let text = ''
      const nested: string[] = []
      for (const child of Array.from(item.childNodes)) {
        if (child.nodeType === 1 && /^(UL|OL)$/.test((child as Element).tagName)) {
          nested.push(listMarkdown(child as Element, depth + 1))
        } else if (child.nodeType === 1 && (child as Element).tagName === 'P') {
          text += (text ? ' ' : '') + inlineMarkdown(child).trim()
        } else {
          text += inlineMarkdown(child)
        }
      }
      return [`${indent}${marker} ${text.trim()}`, ...nested].join('\n')
    })
    .join('\n')
}

function tableMarkdown(table: Element): string[] {
  const rows = Array.from(table.querySelectorAll('tr')).map((row) =>
    Array.from(row.children).map((cell) => inlineMarkdown(cell).trim().replace(/\|/g, '\\|')),
  )
  if (rows.length === 0) return []
  const width = Math.max(...rows.map((row) => row.length))
  const line = (cells: string[]) => `| ${Array.from({ length: width }, (_, i) => cells[i] ?? '').join(' | ')} |`
  return [[line(rows[0]), line(Array.from({ length: width }, () => '---')), ...rows.slice(1).map(line)].join('\n')]
}

/**
 * Markdown for the rendered HTML in `root`: headings, paragraphs, lists,
 * tables, links, bold and italics, `==highlights==` for `<mark>` and
 * `<u>…</u>` for card underlining. Buttons and icons are left out.
 */
export function htmlToMarkdown(root: Element, title?: string): string {
  const blocks = childBlocks(exportableClone(root), 0)
  if (title && !/^# /.test(blocks[0] ?? '')) blocks.unshift(`# ${escapeText(title)}`)
  return blocks.join('\n\n').replace(/\n{3,}/g, '\n\n').trim() + '\n'
}

/** Styles a Word document and a printout share: underlining and highlights kept, as on the page. */
const DOCUMENT_STYLES = `
  body { font-family: Georgia, 'Times New Roman', serif; font-size: 12pt; line-height: 1.5; color: #111; max-width: 46rem; margin: 2rem auto; padding: 0 1rem; }
  h1, h2, h3, h4 { font-family: Calibri, Arial, sans-serif; line-height: 1.25; }
  mark { background: #fff200; color: inherit; }
  u { text-decoration: underline; }
  a { color: #1a4dab; }
  table { border-collapse: collapse; }
  td, th { border: 1px solid #999; padding: 4px 8px; vertical-align: top; }
  img { max-width: 100%; }
  hr { border: 0; border-top: 1px solid #bbb; margin: 2rem 0; }
  @media print { body { margin: 0; max-width: none; } a { color: inherit; } }
`

function escapeHtml(text: string): string {
  return text.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] ?? c)
}

/** The cleaned HTML of `root`, with links and images made absolute. */
export function exportableHtml(root: Element): string {
  const clone = exportableClone(root)
  for (const link of Array.from(clone.querySelectorAll('a[href]'))) {
    const href = link.getAttribute('href') ?? ''
    if (href.startsWith('#')) link.removeAttribute('href')
    else link.setAttribute('href', absoluteUrl(href))
  }
  for (const image of Array.from(clone.querySelectorAll('img[src]'))) {
    image.setAttribute('src', absoluteUrl(image.getAttribute('src') ?? ''))
  }
  return clone.innerHTML
}

/**
 * A standalone HTML document for `html`, titled `title`. Word, Google Docs and
 * the browser's print dialog all read it, so the same page backs the Word
 * download's fallback, the Google Docs copy and the PDF printout.
 */
export function standaloneHtmlDocument(title: string, html: string): string {
  return `<!doctype html>
<html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title><style>${DOCUMENT_STYLES}</style></head>
<body><h1>${escapeHtml(title)}</h1>
${html}
</body></html>`
}
