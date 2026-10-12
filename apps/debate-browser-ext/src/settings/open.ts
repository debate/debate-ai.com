/**
 * Where the extension's settings are: the "Browser extension" tab of the app's
 * own Settings page, on the Options page (entrypoints/options/main.tsx).
 */
import { browser } from 'wxt/browser';

/** The Settings tab's id, and its `?category=` value. */
export const EXTENSION_SETTINGS_CATEGORY = 'browser-extension';

/** The app route that opens on that tab. */
export const EXTENSION_SETTINGS_ROUTE = `/settings?category=${EXTENSION_SETTINGS_CATEGORY}`;

/** Opens the Options page on the extension's Settings tab, or `category` instead. */
export function openExtensionSettings(category: string = EXTENSION_SETTINGS_CATEGORY): void {
  void browser.tabs.create({
    url: browser.runtime.getURL(`/options.html#/settings?category=${encodeURIComponent(category)}`),
  });
}
