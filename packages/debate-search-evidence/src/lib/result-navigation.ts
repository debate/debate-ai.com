/**
 * @fileoverview Keyboard navigation rules for the evidence result list.
 *
 * Split out from the search hook so the two things that are easy to get wrong
 * — which keys move the selection, and when a keystroke belongs to the person
 * typing rather than to the list — can be tested without a DOM.
 *
 * @module lib/result-navigation
 */

/** Keys that move the selection backwards through the result list. */
const PREVIOUS_KEYS = new Set(["ArrowUp", "ArrowLeft"]);

/** Keys that move the selection forwards through the result list. */
const NEXT_KEYS = new Set(["ArrowDown", "ArrowRight"]);

/**
 * Whether a keystroke is being typed into a field and must not be intercepted.
 *
 * The result list listens on `window`, so without this check every arrow key
 * pressed while editing the search box moves the selection instead of the text
 * caret — which is what made the search input feel broken.
 *
 * @param target - The event's target.
 * @returns `true` when the keystroke belongs to a text-entry element.
 */
export function isTypingTarget(target: EventTarget | null): boolean {
  const element = target as (HTMLElement & { tagName?: string }) | null;
  if (!element || typeof element.tagName !== "string") return false;
  if (element.isContentEditable) return true;
  return ["INPUT", "TEXTAREA", "SELECT"].includes(element.tagName.toUpperCase());
}

/**
 * Resolves the index a navigation key should select.
 *
 * Selection does not wrap: holding an arrow key at either end of a long result
 * list should stop there rather than jumping the reader to the other end.
 * `Home` and `End` jump to the ends directly.
 *
 * @param key - `KeyboardEvent.key`.
 * @param currentIndex - Currently selected index, or `-1` when nothing is selected.
 * @param count - Number of results in the list.
 * @returns The index to select, or `null` when the key does not move selection.
 */
export function nextSelectionIndex(
  key: string,
  currentIndex: number,
  count: number,
): number | null {
  if (count <= 0) return null;

  if (key === "Home") return currentIndex === 0 ? null : 0;
  if (key === "End") return currentIndex === count - 1 ? null : count - 1;

  if (NEXT_KEYS.has(key)) {
    // Nothing selected yet: the first press lands on the top result.
    if (currentIndex < 0) return 0;
    return currentIndex < count - 1 ? currentIndex + 1 : null;
  }

  if (PREVIOUS_KEYS.has(key)) {
    if (currentIndex < 0) return null;
    return currentIndex > 0 ? currentIndex - 1 : null;
  }

  return null;
}
