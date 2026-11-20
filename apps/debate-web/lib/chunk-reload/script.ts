/**
 * @fileoverview Reloads the page once when a build chunk fails to load.
 *
 * Client chunks under `/_next/static/` are content-hashed and a deploy
 * replaces the whole set, so a tab opened before a deploy — or an edge that
 * served the new HTML a moment before the new assets — asks for chunks the
 * origin no longer (or does not yet) have. The import rejects, Safari logs
 * `'text/html' is not a valid JavaScript MIME type`, and the route renders
 * blank. A reload fetches the current HTML, which names chunks that exist.
 *
 * Inlined in `<head>` by app/layout.tsx, ahead of the app's module scripts,
 * so it also catches the entry chunk failing on first load. It listens for:
 *
 * - `vite:preloadError`, which vinext's Vite runtime fires when a dynamic
 *   import's preload fails (prevented, so the error is not rethrown);
 * - `error` on a `<script>` / `<link>` whose URL is under `/_next/static/`
 *   (resource errors don't bubble, so the listener captures);
 * - unhandled rejections whose message is a browser's "failed to import a
 *   module" wording, matched by {@link CHUNK_FAILURE_PATTERN}.
 *
 * At most one reload per {@link RELOAD_COOLDOWN_MS}, tracked in
 * sessionStorage, so a chunk that is really gone cannot loop the tab.
 */

/** sessionStorage key holding the time of the last chunk-error reload. */
export const RELOAD_STORAGE_KEY = "dai-chunk-reload-at";

/** Minimum gap between two chunk-error reloads in one tab. */
export const RELOAD_COOLDOWN_MS = 60_000;

/**
 * Browser wordings for a dynamic import that failed: Chrome, Safari, Firefox,
 * plus a MIME rejection and webpack's `ChunkLoadError` name.
 */
export const CHUNK_FAILURE_PATTERN =
  /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module|is not a valid JavaScript MIME type|ChunkLoadError|Loading chunk [\w-]+ failed/i;

/** True when `message` reads like a failed chunk import. */
export function isChunkLoadFailure(message: unknown): boolean {
  return typeof message === "string" && CHUNK_FAILURE_PATTERN.test(message);
}

/** True when a reload last happened longer than the cooldown ago (or never). */
export function mayReload(lastReloadAt: string | null, now: number): boolean {
  const last = Number(lastReloadAt);
  return !lastReloadAt || !Number.isFinite(last) || now - last > RELOAD_COOLDOWN_MS;
}

/** The inline `<head>` script. Self-contained: no imports at runtime. */
export function chunkReloadScript(): string {
  return `(function(){var K=${JSON.stringify(RELOAD_STORAGE_KEY)},C=${RELOAD_COOLDOWN_MS},P=${CHUNK_FAILURE_PATTERN.toString()};function reload(){try{var l=Number(sessionStorage.getItem(K));if(l&&Date.now()-l<=C)return false;sessionStorage.setItem(K,String(Date.now()));}catch(e){}location.reload();return true;}window.addEventListener('vite:preloadError',function(e){if(reload())e.preventDefault();});window.addEventListener('error',function(e){var t=e.target,u=t&&(t.src||t.href);if(typeof u==='string'&&u.indexOf('/_next/static/')!==-1&&(t.tagName==='SCRIPT'||t.tagName==='LINK'))reload();else if(e.message&&P.test(e.message))reload();},true);window.addEventListener('unhandledrejection',function(e){var r=e.reason,m=r&&(r.message||r.name)||String(r);if(P.test(m))reload();});})();`;
}
