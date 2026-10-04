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

/** Attribute that groups the marks of one selection into a single passage. */
export const HIGHLIGHT_ID_ATTRIBUTE = "data-source-highlight-id"

let nextHighlightId = 0

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

  const id = String(nextHighlightId++)
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
    mark.setAttribute(HIGHLIGHT_ID_ATTRIBUTE, id)
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

/** Unwraps one highlight mark, restoring the plain text. */
function unwrapMark(mark: Element): void {
  const parent = mark.parentNode
  if (!parent) return
  while (mark.firstChild) parent.insertBefore(mark.firstChild, mark)
  parent.removeChild(mark)
  parent.normalize()
}

/**
 * Removes every highlight this module added, restoring the original text.
 *
 * @param container - The article body.
 */
export function clearHighlights(container: HTMLElement): void {
  for (const mark of container.querySelectorAll(`mark[${HIGHLIGHT_ATTRIBUTE}]`)) unwrapMark(mark)
}

/**
 * Toggles a highlight off: removes the whole passage (every mark from the
 * same selection) that `target` belongs to.
 *
 * @param container - The article body.
 * @param target - The clicked element; anything inside a highlight mark counts.
 * @returns Whether a highlight was removed.
 */
export function removeHighlightAt(container: HTMLElement, target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false
  const hit = target.closest(`mark[${HIGHLIGHT_ATTRIBUTE}]`)
  if (!hit || !container.contains(hit)) return false

  const id = hit.getAttribute(HIGHLIGHT_ID_ATTRIBUTE)
  const marks = id === null ? [hit] : container.querySelectorAll(`mark[${HIGHLIGHT_ID_ATTRIBUTE}="${id}"]`)
  for (const mark of marks) unwrapMark(mark)
  return true
}

/**
 * Reads the highlighted passages back out of the article, in reading order —
 * one string per selection, so removed highlights drop out of the list.
 *
 * @param container - The article body.
 */
export function collectHighlights(container: HTMLElement): string[] {
  const passages = new Map<string, string[]>()
  for (const mark of container.querySelectorAll(`mark[${HIGHLIGHT_ATTRIBUTE}]`)) {
    const id = mark.getAttribute(HIGHLIGHT_ID_ATTRIBUTE) ?? `anon-${passages.size}`
    const parts = passages.get(id) ?? []
    parts.push(mark.textContent ?? "")
    passages.set(id, parts)
  }
  return [...passages.values()].map((parts) => parts.join(" ").replace(/\s+/g, " ").trim()).filter(Boolean)
}
