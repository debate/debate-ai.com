/**
 * @fileoverview Font-family preference — ported from qwksearch-research-agent's
 * `apps/qwksearch-web` (`components/Settings/Sections/Account.tsx`'s
 * `fontOptions` list plus `app/layout.tsx`'s bootstrap script), which applies a
 * chosen font family app-wide the same way `theme-dropdown.tsx`/`themeSettings.ts`
 * apply a colour theme: persisted to `localStorage` and applied directly as an
 * inline style on `<html>`/`<body>`, picked up immediately by any open tab via a
 * `client-config-changed` custom event (and the cross-tab `storage` event).
 *
 * Unlike colour theme, this preference is local-only (no `/api/settings` sync) —
 * matching the source implementation, which never persists `fontFamily` to an
 * account either.
 *
 * @module state/fontSettings
 */

export type FontOption = {
  name: string;
  value: string;
};

/** "System Default" clears the inline style so the OS/browser default (and Tailwind's `font-sans`) takes over. Every other value is loaded via a Google Fonts `@import` in `app/globals.css`, except the handful of universally pre-installed system fonts (Arial, Courier New, Georgia, Times New Roman, Trebuchet MS, Verdana). */
export const FONT_OPTIONS: readonly FontOption[] = [
  { name: "System Default", value: "system-default" },
  { name: "Arial", value: "Arial" },
  { name: "Courier New", value: "Courier New" },
  { name: "Georgia", value: "Georgia" },
  { name: "Inter", value: "Inter" },
  { name: "Lato", value: "Lato" },
  { name: "Merriweather", value: "Merriweather" },
  { name: "Montserrat", value: "Montserrat" },
  { name: "Nunito", value: "Nunito" },
  { name: "Open Sans", value: "Open Sans" },
  { name: "Oswald", value: "Oswald" },
  { name: "Playfair Display", value: "Playfair Display" },
  { name: "Poppins", value: "Poppins" },
  { name: "PT Sans", value: "PT Sans" },
  { name: "Raleway", value: "Raleway" },
  { name: "Roboto", value: "Roboto" },
  { name: "Roboto Mono", value: "Roboto Mono" },
  { name: "Roboto Slab", value: "Roboto Slab" },
  { name: "Source Code Pro", value: "Source Code Pro" },
  { name: "Source Sans 3", value: "Source Sans 3" },
  { name: "Times New Roman", value: "Times New Roman" },
  { name: "Trebuchet MS", value: "Trebuchet MS" },
  { name: "Ubuntu", value: "Ubuntu" },
  { name: "Verdana", value: "Verdana" },
];

export const DEFAULT_FONT_FAMILY = "system-default";

export function isValidFontFamily(value: unknown): value is string {
  return typeof value === "string" && FONT_OPTIONS.some((opt) => opt.value === value);
}

/** localStorage key — matches qwksearch's `fontFamily` key so both apps' bootstrap scripts share the same shape. */
const STORAGE_KEY = "fontFamily";

/** Fired after `applyFontFamily` so any open tab (including this one's own layout bootstrap script) re-reads and re-applies the stored value. */
const CHANGE_EVENT = "client-config-changed";

/** Reads the persisted font family, falling back to `DEFAULT_FONT_FAMILY` when unset, invalid, or outside the browser. */
export function readLocalFontFamily(): string {
  if (typeof localStorage === "undefined") return DEFAULT_FONT_FAMILY;
  const saved = localStorage.getItem(STORAGE_KEY);
  return saved && isValidFontFamily(saved) ? saved : DEFAULT_FONT_FAMILY;
}

/** Applies a font family as an inline style on `<html>`/`<body>`, mirroring `app/layout.tsx`'s bootstrap script. `"system-default"` (or any other invalid value) clears the inline style instead of setting it, letting `font-sans` take back over. No-op outside the browser. */
export function applyFontFamily(value: string): void {
  if (typeof document === "undefined") return;
  const cssValue = value && value !== DEFAULT_FONT_FAMILY ? value : "";
  document.documentElement.style.fontFamily = cssValue;
  if (document.body) document.body.style.fontFamily = cssValue;
}

/** Persists a font family choice, applies it immediately to this tab, and notifies every other open tab/listener (the layout bootstrap script included) via `client-config-changed`. */
export function setLocalFontFamily(value: string): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(STORAGE_KEY, value);
  applyFontFamily(value);
  window.dispatchEvent(new Event(CHANGE_EVENT));
}
