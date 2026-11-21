/**
 * @file card-voice-text.ts
 * @description What a citation hover card's read-aloud button
 * (`citation-card.tsx`) says: the cite tag once (`Shanahan 93`, from
 * `spokenCite` in `lib/mdx/citation-cards.ts`), then only the card's
 * underlined text, the way a debater reads a card in round.
 *
 * Underlined means the `<u>` runs, plus any `<mark>` highlight outside one
 * (the card CSS underlines those too). The stats line (`.stats`, the 📊
 * word counts) is never read. A card with no underlining reads its text
 * after the qualification line instead, so the button always says the card.
 */

/** Never read: the 📊 stats line. */
const SKIP_SELECTOR = ".stats"

/** Spaces collapsed, ends trimmed. */
function tidy(text: string): string {
  return text.replace(/\s+/g, " ").trim()
}

/** The underlined text of card markup under `root`, runs joined in order. */
export function underlinedCardText(root: Element): string {
  const doc = root.ownerDocument
  const walker = doc.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  const parts: string[] = []
  /** Text was skipped since the last underlined run, so the next run is a separate phrase. */
  let gap = false
  let lastBlock: Element | null = null
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const parent = node.parentElement
    if (!parent || parent.closest(SKIP_SELECTOR)) continue
    const run = parent.closest("u") ?? parent.closest("mark")
    if (!run || !root.contains(run)) {
      if (/\S/.test(node.nodeValue ?? "")) gap = true
      continue
    }
    // Runs split by unread text read as separate phrases; touching runs join as written.
    const block = run.closest("p, li, div")
    if ((gap || block !== lastBlock) && parts.length > 0) parts.push(" ")
    gap = false
    lastBlock = block
    parts.push(node.nodeValue ?? "")
  }
  return tidy(parts.join(""))
}

/** The card's text after its qualification line (the fallback when nothing is underlined). */
function cardBodyText(root: Element): string {
  const card = root.querySelector(".debate-card") ?? root
  const paragraphs = Array.from(card.querySelectorAll("p")).filter((p) => !p.closest(SKIP_SELECTOR))
  const hr = card.querySelector("hr")
  // With a rule: the text after it. Without: everything but the italic qualification line.
  const body = hr
    ? paragraphs.filter((p) => hr.compareDocumentPosition(p) & Node.DOCUMENT_POSITION_FOLLOWING)
    : paragraphs.filter((p) => !(p.children.length === 1 && p.firstElementChild?.tagName === "EM" && tidy(p.textContent ?? "") === tidy(p.firstElementChild.textContent ?? "")))
  return tidy(body.map((p) => p.textContent ?? "").join(" "))
}

/** The texts the button speaks, in order: the cite tag, then the underlined card text. */
export function cardVoiceTexts(spoken: string | undefined, cardHtml: string | undefined, doc: Document = document): string[] {
  const texts: string[] = []
  if (spoken?.trim()) texts.push(`${spoken.trim()}.`)
  if (cardHtml) {
    const root = doc.createElement("div")
    root.innerHTML = cardHtml
    const text = underlinedCardText(root) || cardBodyText(root)
    if (text) texts.push(text)
  }
  return texts
}
