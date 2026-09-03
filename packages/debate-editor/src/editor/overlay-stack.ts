/**
 * Shared modal-overlay stack for Escape handling.
 *
 * Several full-screen overlays (the Learn and Quick-Card dialogs) attach
 * their own document-level, capture-phase Escape listener. When two are
 * open at once, a single Escape press fires every listener — `stopProp-
 * agation` doesn't stop sibling listeners on the same node — so without
 * coordination the whole stack collapses at once.
 *
 * Each participating overlay pushes a token when it opens and pops it when
 * it closes (pair the pop with the same `removeEventListener` cleanup), and
 * guards its Escape branch with `isTopOverlay(token)` so only the topmost
 * overlay reacts. Tokens are opaque and ordered by open time, so the most
 * recently opened overlay is the top.
 *
 * A full shared-modal primitive (focus trap, `role="dialog"`, focus
 * restore, every overlay) is a larger effort; this is the minimal,
 * targeted fix for the stacked-Escape bug.
 */

const stack: symbol[] = [];

/** Mark an overlay as opened; returns its token (pass to the others). */
export function pushOverlay(): symbol {
  const token = Symbol('overlay');
  stack.push(token);
  return token;
}

/** Mark an overlay as closed. Safe to call with an already-removed token. */
export function popOverlay(token: symbol): void {
  const i = stack.lastIndexOf(token);
  if (i >= 0) stack.splice(i, 1);
}

/** Whether `token` is the topmost (most recently opened) overlay. */
export function isTopOverlay(token: symbol): boolean {
  return stack.length > 0 && stack[stack.length - 1] === token;
}

/** Whether any overlay is currently open — i.e. a modal is layered over the
 *  page. Used by background key handlers (e.g. the home screen's number
 *  shortcuts) to stand down while a modal has the user's attention. */
export function isAnyOverlayOpen(): boolean {
  return stack.length > 0;
}
