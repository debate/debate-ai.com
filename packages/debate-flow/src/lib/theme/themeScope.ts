/**
 * The element ebb's theme (the `dark` class, `--font-flow`) applies to.
 *
 * Standalone, ebb owns the whole page, so this defaults to `<html>` - the
 * same element the layout's no-flash bootstrap script sets before first
 * paint. Embedded in a host page, applying a debater's theme/font choice to
 * `<html>` would flip the *host's* dark mode and default font along with
 * ebb's own, since that element is shared. `EbbFlowEmbed` points this at its
 * own root (`.ebb-scope`) on mount so those choices stay inside the panel.
 */

let scopeEl: HTMLElement | null = null;

export function setEbbThemeScope(el: HTMLElement | null): void {
    scopeEl = el;
}

export function ebbThemeScopeEl(): HTMLElement {
    return scopeEl ?? document.documentElement;
}
