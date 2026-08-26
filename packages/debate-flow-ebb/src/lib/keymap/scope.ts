/**
 * Confines ebb's global `window` keydown listeners (useKeymap, the start
 * screen) to one DOM subtree.
 *
 * Standalone, ebb owns the whole page and every keydown is its own - no
 * scope is registered, and `withinEbbKeyScope` is a no-op true. Embedded in
 * a host page (a debate-round panel, an editor sidebar) that is no longer
 * true: ebb is one column among others, and its capture-phase interceptor
 * would otherwise steal keystrokes typed into the host's own grid or editor
 * anywhere on the page. `EbbFlowEmbed` registers its root element here on
 * mount, so a chord only resolves as ebb's when the event actually
 * originated inside that column.
 */

let scopeEl: HTMLElement | null = null;

export function setEbbKeyScope(el: HTMLElement | null): void {
    scopeEl = el;
}

export function withinEbbKeyScope(target: EventTarget | null): boolean {
    if (!scopeEl) return true;
    return target instanceof Node && scopeEl.contains(target);
}
