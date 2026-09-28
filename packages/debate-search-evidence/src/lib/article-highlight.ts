/**
 * @fileoverview Highlighting the reader's selection inside a source article.
 *
 * A selection routinely spans several paragraphs, so wrapping the whole range
 * in one element (`Range.surroundContents`) either throws or drags block
 * elements inside an inline `<mark>`. Instead every text node the range
 * touches is split at the range's edges and just the selected part wrapped —
 * one `<mark>` per text run, the article's structure left as it was.
 *
 * @module lib/article-highlight
 */

/** Attribute that tells this module's marks apart from the article's own. */
export const HIGHLIGHT_ATTRIBUTE = "data-source-highlight"

/**
 * Wraps the part of `range` that lies inside `container` in highlight marks.
 *
 * @param container - The article body; nothing outside it is touched.
 * @param range - The reader's selection.
 * @returns The highlighted text, or `""` when the range held none.
 */
export function highlightRange(container: HTMLElement, range: Range): string {
  const doc = container.ownerDocument
  const walker = doc.createTreeWalker(container, NodeFilter.SHOW_TEXT, {
    acceptNode: (node) =>
      range.intersectsNode(node) && node.nodeValue?.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT,
  })

  const nodes: Text[] = []
  for (let node = walker.nextNode(); node; node = walker.nextNode()) nodes.push(node as Text)

  const pieces: string[] = []
  for (const node of nodes) {
    const start = node === range.startContainer ? range.startOffset : 0
    const end = node === range.endContainer ? range.endOffset : node.length
    if (end <= start) continue

    // Split off the unselected tail, then the unselected head, leaving
    // `selected` as exactly the text inside the range.
    if (end < node.length) node.splitText(end)
    const selected = start > 0 ? node.splitText(start) : node

    const mark = doc.createElement("mark")
    mark.setAttribute(HIGHLIGHT_ATTRIBUTE, "")
    selected.parentNode?.replaceChild(mark, selected)
    mark.appendChild(selected)
    pieces.push(selected.data)
  }
  return pieces.join(" ").replace(/\s+/g, " ").trim()
}

/**
 * Highlights the document's current selection if it lies in `container`,
 * then clears the selection.
 *
 * @param container - The article body.
 * @returns The highlighted text, or `""` when nothing inside was selected.
 */
export function highlightSelection(container: HTMLElement): string {
  const selection = container.ownerDocument.defaultView?.getSelection()
  if (!selection || selection.isCollapsed || selection.rangeCount === 0) return ""

  const range = selection.getRangeAt(0)
  if (!container.contains(range.commonAncestorContainer)) return ""

  const text = highlightRange(container, range)
  selection.removeAllRanges()
  return text
}

/**
 * Removes every highlight this module added, restoring the original text.
 *
 * @param container - The article body.
 */
export function clearHighlights(container: HTMLElement): void {
  for (const mark of container.querySelectorAll(`mark[${HIGHLIGHT_ATTRIBUTE}]`)) {
    const parent = mark.parentNode
    if (!parent) continue
    while (mark.firstChild) parent.insertBefore(mark.firstChild, mark)
    parent.removeChild(mark)
    parent.normalize()
  }
}
