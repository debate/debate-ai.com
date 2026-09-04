import { type FontId, fontCssVar } from "./registry";
import { ebbThemeScopeEl } from "../theme/themeScope";

/**
 * Writes the chosen flow font's CSS variable onto `--font-flow` at ebb's
 * theme root (see themeScope.ts). `.flow` (cells + inline editor) reads
 * `var(--font-flow, …)`, so this is the single point that switches the flow
 * typeface. SSR-safe no-op.
 */
export function applyFlowFont(id: FontId): void {
    if (typeof document === "undefined") return;
    ebbThemeScopeEl().style.setProperty("--font-flow", fontCssVar(id));
}
