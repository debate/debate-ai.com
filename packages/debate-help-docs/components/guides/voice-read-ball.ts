/**
 * @file voice-read-ball.ts
 * @description The little light that follows the word the Voice reader is
 * saying (`voice-read-button.tsx`): a ball under the active word that glides
 * from word to word. Styled by `[data-voice-ball]` in `styles/docs.css`.
 * It keeps the word in view, scrolling the page when the word leaves it.
 */
import type { VoiceWord } from "./voice-read-text"

/** Set on the ball; `styles/docs.css` draws it. */
export const BALL_ATTRIBUTE = "data-voice-ball"
/** Words nearer than this to the top or bottom of the window are scrolled back into view. */
const VIEW_MARGIN = 96
/** Pause between scrolls, so a smooth scroll can finish. */
const SCROLL_GAP_MS = 700

export interface VoiceBall {
  /** Moves the ball under `word`; hides it when the word cannot be found on the page. */
  show(word: VoiceWord | undefined): void
  hide(): void
  /** Removes the ball from the page. */
  destroy(): void
}

/** The word's rectangle in the viewport, or null when it is no longer in the page. */
function wordRect(word: VoiceWord): DOMRect | null {
  const { start, end } = word
  if (!start || !end || !start.node.isConnected || !end.node.isConnected) return null
  const range = start.node.ownerDocument.createRange()
  try {
    range.setStart(start.node, start.offset)
    range.setEnd(end.node, end.offset)
  } catch {
    return null
  }
  const rect = range.getClientRects()[0] ?? range.getBoundingClientRect()
  return rect.width > 0 || rect.height > 0 ? rect : null
}

/** Makes the ball (hidden until the first word). */
export function createVoiceBall(doc: Document = document): VoiceBall {
  const ball = doc.createElement("span")
  ball.setAttribute(BALL_ATTRIBUTE, "hidden")
  ball.setAttribute("aria-hidden", "true")
  doc.body.appendChild(ball)
  let placed = false
  let lastScroll = 0

  return {
    show(word) {
      const rect = word ? wordRect(word) : null
      if (!rect) {
        ball.setAttribute(BALL_ATTRIBUTE, "hidden")
        placed = false
        return
      }
      const view = doc.defaultView
      const x = rect.left + rect.width / 2 + (view?.scrollX ?? 0)
      const y = rect.bottom + (view?.scrollY ?? 0)
      ball.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`
      // The first placement jumps; the rest glide.
      ball.setAttribute(BALL_ATTRIBUTE, placed ? "moving" : "shown")
      placed = true
      const height = view?.innerHeight ?? 0
      const now = Date.now()
      if (view && (rect.top < VIEW_MARGIN || rect.bottom > height - VIEW_MARGIN) && now - lastScroll > SCROLL_GAP_MS) {
        lastScroll = now
        view.scrollBy({ top: rect.top - height * 0.4, behavior: "smooth" })
      }
    },
    hide() {
      ball.setAttribute(BALL_ATTRIBUTE, "hidden")
      placed = false
    },
    destroy() {
      ball.remove()
    },
  }
}
