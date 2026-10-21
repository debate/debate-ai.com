/**
 * @fileoverview Reduces Debate Editor's exported HTML to what a debater reads
 * aloud — the same rule the editor's read mode applies, for docs shown as
 * static HTML without booting the editor.
 *
 * Card body and undertag paragraphs keep only highlighted text; cite
 * paragraphs keep the cite and any highlights. A paragraph left with nothing
 * is dropped. Pockets, hats, blocks, tags, analytics and plain paragraphs are
 * untouched.
 *
 * @module round/highlighted-only-html
 */

/** Paragraphs whose unmarked text is hidden, mapped to the marks they keep. */
const KEEP_IN: Record<string, string> = {
  "pmd-card-body": ".pmd-highlight",
  "pmd-undertag": ".pmd-highlight",
  "pmd-cite-para": ".pmd-highlight, .pmd-cite",
}

/** Returns `html` with only the read-aloud text of each card left. */
export function highlightedOnlyHtml(html: string): string {
  const doc = new DOMParser().parseFromString(`<body>${html}</body>`, "text/html")
  for (const [className, keep] of Object.entries(KEEP_IN)) {
    for (const para of Array.from(doc.body.querySelectorAll(`p.${className}`))) {
      const walker = doc.createTreeWalker(para, NodeFilter.SHOW_TEXT)
      const dropped: Text[] = []
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        const kept = node.parentElement?.closest(keep)
        if (!kept || !para.contains(kept)) dropped.push(node as Text)
      }
      // A space keeps neighbouring highlighted words from running together.
      for (const text of dropped) text.data = " "
      if (!para.textContent?.trim()) para.remove()
    }
  }
  return doc.body.innerHTML
}
