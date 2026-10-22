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

/**
 * Where "Open Debate AI (local)" lands: the Research tab's document editor
 * (`QWKSEARCH_DOCS_ROUTE` in debate-webview's `lib/qwksearch/doc-paths.ts`),
 * served by the extension's own bundled copy of the app.
 */
export const LOCAL_APP_ROUTE = '/research/docs';

/** Opens the app bundled in the extension (the Options page) on `route`. */
export function openLocalApp(route: string = LOCAL_APP_ROUTE): void {
  void browser.tabs.create({ url: browser.runtime.getURL(`/options.html#${route}`) });
}
