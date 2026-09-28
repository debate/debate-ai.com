/**
 * @fileoverview Scrolls an element into view inside its own scroll box only.
 *
 * `Element.scrollIntoView` scrolls every scrollable ancestor, the page
 * included — so a side panel following playback would keep yanking the whole
 * watch page back up to it while the reader is scrolled down to the related
 * videos. This moves just the nearest Radix scroll-area viewport.
 * @module lib/scroll-within
 */

const VIEWPORT_SELECTOR = '[data-slot="scroll-area-viewport"]'

/**
 * @param element - The row or section to bring into view.
 * @param block - Where it should land: the viewport's top, or its middle.
 */
export function scrollWithin(
  element: HTMLElement | null | undefined,
  block: "start" | "center" = "start",
): void {
  if (!element) return
  const viewport = element.closest<HTMLElement>(VIEWPORT_SELECTOR)
  if (!viewport) return
  const offset =
    element.getBoundingClientRect().top - viewport.getBoundingClientRect().top + viewport.scrollTop
  const top =
    block === "center" ? offset - (viewport.clientHeight - element.offsetHeight) / 2 : offset - 8
  if (typeof viewport.scrollTo === "function") {
    viewport.scrollTo({ top: Math.max(0, top), behavior: "smooth" })
  } else {
    viewport.scrollTop = Math.max(0, top)
  }
}
