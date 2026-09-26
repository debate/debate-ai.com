/**
 * Highlights in the article panel: passages the reader marks while reading.
 *
 * Highlight mode used to only tint the browser's own selection, which is gone
 * the moment the reader clicks anywhere else — nothing was actually marked.
 * These are real `<mark>` elements wrapped around the selected text, so they
 * stay put while the reader keeps reading, can be removed with a click, and
 * are what the panel's AI is asked about (see entrypoints/reader/App.tsx).
 *
 * A selection can start in one paragraph and end in another, so it is never
 * wrapped as a single element: each text node it touches gets its own `<mark>`,
 * all sharing one `data-highlight-id` so the passage is removed as a whole.
 */

/** Class on every highlight `<mark>`, styled in src/styles/sidepanel.css. */
export const HIGHLIGHT_CLASS = 'reader-highlight';

let nextId = 0;

/** The text nodes `range` covers, in document order, trimmed to the range. */
function textNodesIn(range: Range, root: Node): Text[] {
  const doc = root.ownerDocument ?? (root as Document);
  const walker = doc.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = [];
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const text = node as Text;
    if (!text.data.trim() || !range.intersectsNode(text)) continue;
    nodes.push(text);
  }
  return nodes;
}

/**
 * Wraps the part of `range` inside `root` in highlight marks. Returns the new
 * highlight's id, or `null` when the range covers no text in `root`.
 */
export function highlightRange(range: Range, root: HTMLElement): string | null {
  if (range.collapsed || !root.contains(range.commonAncestorContainer)) return null;

  const id = `h${Date.now().toString(36)}-${nextId++}`;
  const { startContainer, startOffset, endContainer, endOffset } = range;
  let wrapped = 0;

  for (const node of textNodesIn(range, root)) {
    // Already highlighted text stays in its existing highlight.
    if (node.parentElement?.closest(`mark.${HIGHLIGHT_CLASS}`)) continue;

    let target = node;
    // Trim the end first so the start offset still points into `target`.
    if (node === endContainer && endOffset < node.length) target.splitText(endOffset);
    if (node === startContainer && startOffset > 0) target = target.splitText(startOffset);
    if (!target.data.trim()) continue;

    const mark = root.ownerDocument.createElement('mark');
    mark.className = HIGHLIGHT_CLASS;
    mark.dataset.highlightId = id;
    target.replaceWith(mark);
    mark.appendChild(target);
    wrapped++;
  }
  return wrapped > 0 ? id : null;
}

/** Removes every mark of the highlight `id`, leaving its text in place. */
export function removeHighlight(root: HTMLElement, id: string): void {
  root.querySelectorAll<HTMLElement>(`mark.${HIGHLIGHT_CLASS}`).forEach((mark) => {
    if (mark.dataset.highlightId !== id) return;
    const parent = mark.parentNode;
    if (!parent) return;
    while (mark.firstChild) parent.insertBefore(mark.firstChild, mark);
    parent.removeChild(mark);
    parent.normalize();
  });
}

/** Removes every highlight in `root`. */
export function clearHighlights(root: HTMLElement): void {
  const ids = new Set(
    Array.from(root.querySelectorAll<HTMLElement>(`mark.${HIGHLIGHT_CLASS}`)).map(
      (mark) => mark.dataset.highlightId ?? '',
    ),
  );
  ids.forEach((id) => removeHighlight(root, id));
}

/** Each highlighted passage's text, in reading order, one entry per highlight. */
export function highlightedPassages(root: HTMLElement): string[] {
  const byId = new Map<string, string[]>();
  root.querySelectorAll<HTMLElement>(`mark.${HIGHLIGHT_CLASS}`).forEach((mark) => {
    const id = mark.dataset.highlightId ?? '';
    const parts = byId.get(id) ?? [];
    parts.push(mark.textContent ?? '');
    byId.set(id, parts);
  });
  return Array.from(byId.values())
    .map((parts) => parts.join(' ').replace(/\s+/g, ' ').trim())
    .filter(Boolean);
}
