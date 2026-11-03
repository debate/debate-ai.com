/**
 * @file voice-read-text.ts
 * @description The text the Synergy Slayer "Voice" button
 * (`voice-read-button.tsx`) reads: every visible passage of the page, top to
 * bottom, one block (paragraph, heading, list item, table cell) at a time,
 * leaving out the figures — the images and their `*Figure N: …*` captions.
 *
 * Text is gathered from text nodes and grouped by their nearest block
 * element, so a list item holding a paragraph or a nested list is read once
 * and in order. Hidden content (a closed accordion or `<details>`) is
 * skipped, so the reader hears what the page shows.
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

function hidden(el: Element): boolean {
  const check = (el as Element & { checkVisibility?: () => boolean }).checkVisibility
  if (typeof check === "function") return !check.call(el)
  // Older browsers: a hidden ancestor, or the body of a closed <details>.
  return !!el.closest("[hidden], details:not([open]) > :not(summary)")
}

/** One passage Voice reads, with the element it scrolls to and outlines. */
export interface VoiceBlock {
  element: Element
  text: string
}

/** Highlighted text: the `==text==` marks and the References cards' highlights. */
const HIGHLIGHT_SELECTOR = "mark"

export interface CollectVoiceOptions {
  /** Read only highlighted text (the Underlining toggle is on). */
  highlightedOnly?: boolean
}

/** The passages under `root` that Voice reads, in page order (see the module doc). */
export function collectVoiceBlocks(root: Element, options: CollectVoiceOptions = {}): VoiceBlock[] {
  const { highlightedOnly = false } = options
  const doc = root.ownerDocument
  const walker = doc.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  const blocks: VoiceBlock[] = []
  let currentElement: Element | null = null
  let parts: string[] = []
  let lastMark: Element | null = null
  const flush = () => {
    const text = parts.join("").replace(/\s+/g, " ").trim()
    if (currentElement && text && /[\p{L}\p{N}]/u.test(text) && !isFigureCaption(text)) {
      blocks.push({ element: currentElement, text })
    }
    currentElement = null
    parts = []
  }

  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const parent = node.parentElement
    if (!parent || parent.closest(SKIP_SELECTOR) || hidden(parent)) continue
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
    if (mark && lastMark && mark !== lastMark) parts.push(" ")
    lastMark = mark
    parts.push(node.nodeValue ?? "")
  }
  flush()
  return blocks
}
