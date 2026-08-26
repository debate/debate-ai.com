/**
 * Attributes that ask password-manager / autofill browser extensions to leave
 * one of our text inputs alone.
 *
 * Why this exists: on the WEB edition, extensions like 1Password inject a
 * content script that, whenever an `<input>` gains focus, crawls the ENTIRE
 * page DOM (a `TreeWalker` plus `getBoundingClientRect` on every candidate) to
 * hunt for login fields and their labels. On a large document that scan takes
 * ~2s and freezes the UI every time the command palette or find bar
 * opens (both focus a search box). Electron loads no extensions, so the desktop
 * app never pays this. `autocomplete="off"` alone doesn't help — the managers
 * ignore it — so we also send each vendor's explicit "skip this field" hint,
 * which short-circuits the crawl before it walks the doc.
 *
 * Best-effort: a manager may still collect page details on load / mutation. The
 * guaranteed fix is user-side (set the extension's site access to "on click").
 *
 *   - autocomplete="off"       standard (kept, though widely ignored by managers)
 *   - data-1p-ignore           1Password
 *   - data-lpignore="true"     LastPass
 *   - data-bwignore            Bitwarden
 *   - data-form-type="other"   Dashlane / generic
 */

/** Attribute string for inputs built via an `innerHTML` template literal. */
export const AUTOFILL_IGNORE_ATTRS =
  'autocomplete="off" data-1p-ignore data-lpignore="true" data-bwignore data-form-type="other"';

/** Stamp the same ignore hints onto an input built with `createElement`. */
export function suppressAutofill(el: HTMLElement): void {
  el.setAttribute('autocomplete', 'off');
  el.setAttribute('data-1p-ignore', '');
  el.setAttribute('data-lpignore', 'true');
  el.setAttribute('data-bwignore', '');
  el.setAttribute('data-form-type', 'other');
}
