import type { Side } from "../model/types";

/**
 * The theme's default aff/neg ink (the `:root` light values from globals.css).
 * Used to seed the settings color swatches when a side has no custom override.
 */
export const DEFAULT_SIDE_COLORS: Record<Side, string> = {
    aff: "#1d4ed8",
    neg: "#c0271f",
};

/** A user's custom aff/neg color; null keeps that side's theme default. */
export interface SideColors {
    aff: string | null;
    neg: string | null;
}

const STYLE_ID = "ebb-side-colors";

/**
 * Overrides aff/neg with the user's picks by injecting one <style> element.
 * It targets :root, .dark, AND .handsontable so a custom color reaches both the
 * chrome (light + dark) and the light-locked flow sheet, whose own
 * `.handsontable` rule would otherwise re-pin the default ink. A null side emits
 * nothing, leaving that side's theme default in place. SSR-safe no-op.
 */
export function applySideColors({ aff, neg }: SideColors): void {
    if (typeof document === "undefined") return;

    const decls = [aff && `--aff: ${aff};`, neg && `--neg: ${neg};`].filter(Boolean).join(" ");
    let el = document.getElementById(STYLE_ID) as HTMLStyleElement | null;

    if (!decls) {
        el?.remove();
        return;
    }
    if (!el) {
        el = document.createElement("style");
        el.id = STYLE_ID;
        document.head.appendChild(el);
    }
    el.textContent = `:root, .dark, .handsontable { ${decls} }`;
}
