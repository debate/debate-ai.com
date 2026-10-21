/**
 * Site constants the templates need. Repeated here rather than imported from
 * `@debate/webview/lib/config/site` so this package stays a leaf with no
 * dependency on the app's frontend; keep the values in sync with that file.
 */
export const APP_NAME = "Debate AI";
export const SUPPORT_EMAIL = "support@debate-ai.com";

/**
 * The canonical host (`CANONICAL_HOST` in apps/debate-web/wrangler.jsonc).
 * Senders pass the request's own origin instead so staging links stay on
 * staging; this is the fallback for previews.
 */
export const DEFAULT_BASE_URL = "https://d.ebate.app";

/**
 * The wordmark is `logo.png` in `@debate/icons/brand`, which the app also
 * serves at `/logo.png` (`ROOT_ASSETS` in apps/debate-web/vite.config.ts).
 * Emails need an absolute URL, so they link to that copy.
 */
export const LOGO_WIDTH = 400;
export const LOGO_HEIGHT = 89;

/** An absolute link to `path` on the site. */
export function siteUrl(baseUrl: string | undefined, path: string): string {
  return new URL(path, baseUrl || DEFAULT_BASE_URL).toString();
}
