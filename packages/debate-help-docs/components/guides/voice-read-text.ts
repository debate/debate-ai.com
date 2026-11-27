/**
 * @file voice-read-text.ts
 * @description The text the Synergy Slayer "Voice" button
 * (`voice-read-button.tsx`) reads: every visible passage of the page, top to
 * bottom, one block (paragraph, heading, list item, table cell) at a time,
 * leaving out the figures — the images and their `*Figure N: …*` captions.
 *
 * Text is gathered from text nodes and grouped by their nearest block
 * element, so a list item holding a paragraph or a nested list is read once
 * and in order. Collapsed content (a closed `<details>`, such as the
 * References cards) is read too, so nothing on the page is left out.
 *
 * With `highlightedOnly` (the Underlining toggle is on), only the highlighted
 * words are read, the way a debater reads a card: each block keeps just its
 * `<mark>` runs, joined with spaces, and blocks with none are skipped.
 */

/** Elements a block of reading text belongs to; the nearest one wins. */
const BLOCK_SELECTOR =
  "p, li, h1, h2, h3, h4, h5, h6, blockquote, td, th, dt, dd, summary, pre, div"

/** Nothing inside these is read: figures, icons, scripts, and anything marked to skip. */
const SKIP_SELECTOR =
  'figure, figcaption, img, picture, svg, video, audio, canvas, script, style, noscript, [aria-hidden="true"], [data-voice-skip]'

/** A figure caption paragraph, as the papers write them: `*Figure 4: …*`. */
const FIGURE_CAPTION = /^(figure|fig\.)\s*\d+[a-z]?\s*[:.–—-]/i

/** True when `text` is a figure caption, which Voice leaves out. */
export function isFigureCaption(text: string): boolean {
  return FIGURE_CAPTION.test(text.trim())
}

/** Where a word begins or ends in the page: a text node and the offset in it. */
export interface VoicePoint {
  node: Text
  offset: number
}

/** One word of a passage, with where it sits in the page (for the moving ball and click-to-seek). */
export interface VoiceWord {
  text: string
  start: VoicePoint | null
  end: VoicePoint | null
}

/** One passage Voice reads, with the element it scrolls to and outlines. */
export interface VoiceBlock {
  element: Element
  /** What is spoken: `words` from `first` on, joined with single spaces. */
  text: string
  /** Every word of the passage, in order. */
  words: VoiceWord[]
  /** Index in `words` of the first spoken word (above 0 when reading starts mid-passage). */
  first: number
}

/** The passage with only its words from `index` on spoken. */
export function blockFromWord(block: VoiceBlock, index: number): VoiceBlock {
  const first = Math.min(Math.max(0, index), Math.max(0, block.words.length - 1))
  return { ...block, first, text: block.words.slice(first).map((word) => word.text).join(" ") }
}

/** Highlighted text: the `==text==` marks and the References cards' highlights. */
const HIGHLIGHT_SELECTOR = "mark"

export interface CollectVoiceOptions {
  /** Read only highlighted text (the Underlining toggle is on). */
  highlightedOnly?: boolean
}

/** The words of `raw` (the passage's parts joined), each located in the text node its parts came from. */
function wordsOf(raw: string, parts: string[], sources: Array<Text | null>): VoiceWord[] {
  /** Index in `raw` where each part starts. */
  const starts: number[] = []
  let at = 0
  for (const part of parts) {
    starts.push(at)
    at += part.length
  }
  const locate = (index: number, atEnd: boolean): VoicePoint | null => {
    for (let i = 0; i < parts.length; i++) {
      const begin = starts[i]!
      const end = begin + parts[i]!.length
      const inside = atEnd ? index > begin && index <= end : index >= begin && index < end
      if (!inside) continue
      const source = sources[i]
      return source ? { node: source, offset: index - begin } : null
    }
    return null
  }
  const words: VoiceWord[] = []
  for (const match of raw.matchAll(/\S+/g)) {
    const begin = match.index ?? 0
    words.push({ text: match[0], start: locate(begin, false), end: locate(begin + match[0].length, true) })
  }
  return words
}

/** The passages under `root` that Voice reads, in page order (see the module doc). */
export function collectVoiceBlocks(root: Element, options: CollectVoiceOptions = {}): VoiceBlock[] {
  const { highlightedOnly = false } = options
  const doc = root.ownerDocument
  const walker = doc.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  const blocks: VoiceBlock[] = []
  let currentElement: Element | null = null
  let parts: string[] = []
  /** Which text node each part came from (null for the spaces added between highlighted runs). */
  let sources: Array<Text | null> = []
  let lastMark: Element | null = null
  const flush = () => {
    const raw = parts.join("")
    const text = raw.replace(/\s+/g, " ").trim()
    if (currentElement && text && /[\p{L}\p{N}]/u.test(text) && !isFigureCaption(text)) {
      blocks.push({ element: currentElement, text, words: wordsOf(raw, parts, sources), first: 0 })
    }
    currentElement = null
    parts = []
    sources = []
  }

  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const parent = node.parentElement
    if (!parent || parent.closest(SKIP_SELECTOR)) continue
    const mark = highlightedOnly ? parent.closest(HIGHLIGHT_SELECTOR) : null
    if (highlightedOnly && !mark) continue
    const block = parent.closest(BLOCK_SELECTOR) ?? root
    const element = root.contains(block) ? block : root
    if (currentElement !== element) {
      flush()
      currentElement = element
      lastMark = null
    }
    // Separate highlighted runs read as separate words.
    if (mark && lastMark && mark !== lastMark) {
      parts.push(" ")
      sources.push(null)
    }
    lastMark = mark
    parts.push(node.nodeValue ?? "")
    sources.push(node as Text)
  }
  flush()
  return blocks
}
