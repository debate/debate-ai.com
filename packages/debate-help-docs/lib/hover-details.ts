/**
 * @file hover-details.ts
 * @description Hover-to-expand for reference lists. On a References page each
 * entry is a `<details>` card; pointing at an entry opens it, and moving the
 * pointer off closes it again, so readers can skim cards without clicking.
 *
 * Only entries opened by hover close on leave. An entry opened by click,
 * by "Expand all" or by a `#ref-…` link stays open. Clicking the summary of
 * an entry the hover just opened keeps it open (pins it) instead of closing
 * it under the pointer. Mounted by `components/guides/expand-all-details.tsx`.
 */

/** Delay before a hovered entry opens, so sweeping the pointer or scrolling past entries doesn't open each one. */
export const HOVER_OPEN_DELAY_MS = 150

/** Entries currently open only because the pointer is over them. */
const hoverOpened = new WeakSet<HTMLDetailsElement>()

/** True when `details` is open because of hover (and will close on leave). */
export function isHoverOpened(details: HTMLDetailsElement): boolean {
  return hoverOpened.has(details)
}

/** Forget hover state for every entry, e.g. after "Expand all"/"Collapse all" set them all. */
export function clearHoverOpened(root: ParentNode): void {
  root.querySelectorAll("details").forEach((d) => hoverOpened.delete(d))
}

/**
 * Makes the list entries (`<details>` inside an `<li>`) under `root` open on hover and close
 * on leave. Returns a cleanup function that removes the listeners.
 */
export function attachHoverExpand(root: ParentNode, delayMs = HOVER_OPEN_DELAY_MS): () => void {
  const cleanups: Array<() => void> = []
  root.querySelectorAll<HTMLDetailsElement>("li details").forEach((details) => {
    let timer: ReturnType<typeof setTimeout> | undefined
    const enter = () => {
      if (details.open) return
      timer = setTimeout(() => {
        timer = undefined
        if (details.open) return
        details.open = true
        hoverOpened.add(details)
      }, delayMs)
    }
    const leave = () => {
      if (timer !== undefined) clearTimeout(timer)
      timer = undefined
      if (!hoverOpened.has(details)) return
      hoverOpened.delete(details)
      details.open = false
    }
    const click = (event: Event) => {
      const summary = details.querySelector(":scope > summary")
      if (!summary || !(event.target instanceof Node) || !summary.contains(event.target)) return
      if (timer !== undefined) {
        // Clicked before the hover delay ran: let the click open it, pinned.
        clearTimeout(timer)
        timer = undefined
        return
      }
      if (!hoverOpened.has(details)) return
      // Opened by hover: a click pins it open rather than closing it.
      event.preventDefault()
      hoverOpened.delete(details)
    }
    details.addEventListener("mouseenter", enter)
    details.addEventListener("mouseleave", leave)
    details.addEventListener("click", click)
    cleanups.push(() => {
      if (timer !== undefined) clearTimeout(timer)
      details.removeEventListener("mouseenter", enter)
      details.removeEventListener("mouseleave", leave)
      details.removeEventListener("click", click)
    })
  })
  return () => cleanups.forEach((fn) => fn())
}
