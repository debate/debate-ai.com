/**
 * @fileoverview A self-referencing `<link rel="canonical">` for every public
 * HTML page, added by the Worker.
 *
 * Search Console reported pages as "Duplicate without user-selected
 * canonical": only the video pages and a handful of moved routes ever set
 * `alternates.canonical`, and the same page answers on several addresses —
 * `d.ebate.app` and `debate-ai.com`, `http://` and `https://`, and with any
 * query string (`/videos?year=2025`, tracking parameters). Without a canonical
 * Google picks one of those for itself.
 *
 * ## Why the Worker adds it, and not the root layout's metadata
 *
 * Next's `alternates: { canonical: "./" }` in the root layout would resolve
 * against the *route* pathname, which after a `next.config` rewrite is the
 * internal one (`/@harker-ll` renders `/teams/harker-ll`, every Topic Starter
 * under `/docs/<code>/…` renders `/reason-editor`). The Worker holds the
 * address the visitor actually asked for, so it is the one place the canonical
 * cannot name an internal path.
 *
 * ## Pages that name their own canonical win
 *
 * The rewriter only adds a link when the page's `<head>` has none. A page that
 * sets `alternates.canonical` (a video under a speech suffix points at the
 * video itself; a moved tool points at its new `?section=`) keeps its own.
 * That needs the page's metadata in `<head>`, which vinext only does for the
 * crawlers in `htmlLimitedBots` — `next.config.mjs` adds Googlebot to that
 * list for exactly this reason. For other visitors metadata streams into the
 * body, which no search engine reads a canonical from.
 * @module lib/seo/canonical-link
 */

import { absoluteUrl } from "@/lib/seo/site-url";

/**
 * Query parameters that choose a different page rather than a different view
 * of the same one, and so stay in the canonical URL.
 *
 * `section` picks the tab of a hub page (`/research?section=review`,
 * `/news?section=forums`); the moved-route canonicals already name those as
 * separate pages. Everything else — filters, sort order, `utm_*`, `ref` — is
 * dropped.
 */
export const CANONICAL_QUERY_PARAMS = ["section"] as const;

/** A query value safe to keep: a short lowercase slug. */
const SLUG_VALUE = /^[a-z0-9][a-z0-9-]{0,63}$/;

/**
 * Path prefixes that must not be given a canonical: they are `noindex` on
 * purpose (the mini player, the developer docs) or are not pages at all.
 */
export const NO_CANONICAL_PREFIXES = ["/api", "/videos/mini", "/docs/dev"] as const;

/**
 * The canonical URL for a request, or `null` when it should get none.
 *
 * Normalises the path (repeated and trailing slashes removed, root kept as
 * `/`), keeps only {@link CANONICAL_QUERY_PARAMS}, and always uses the
 * configured canonical origin rather than the host the request arrived on.
 *
 * @param requestUrl - The URL the visitor requested.
 * @returns e.g. `https://d.ebate.app/videos`, or `null`.
 */
export function canonicalUrlFor(requestUrl: string | URL): string | null {
  let url: URL;
  try {
    url = new URL(requestUrl.toString());
  } catch {
    return null;
  }

  let path = url.pathname.replace(/\/{2,}/g, "/");
  if (path.length > 1) path = path.replace(/\/+$/, "");
  if (!path) path = "/";

  if (NO_CANONICAL_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`))) return null;

  const kept = new URLSearchParams();
  for (const name of CANONICAL_QUERY_PARAMS) {
    const value = url.searchParams.get(name)?.trim().toLowerCase();
    if (value && SLUG_VALUE.test(value)) kept.set(name, value);
  }
  const query = kept.toString();
  return absoluteUrl(query ? `${path}?${query}` : path);
}

/** Escapes a value for a double-quoted HTML attribute. */
function escapeAttribute(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** The `<link>` tag for a canonical URL. */
export function canonicalLinkTag(href: string): string {
  return `<link rel="canonical" href="${escapeAttribute(href)}" />`;
}

/** The subset of Cloudflare's `HTMLRewriter` this module uses. */
interface RewriterEndTag {
  before(content: string, options?: { html: boolean }): void;
}
interface RewriterElement {
  onEndTag(handler: (end: RewriterEndTag) => void): void;
}
interface Rewriter {
  on(selector: string, handlers: { element(element: RewriterElement): void }): Rewriter;
  transform(response: Response): Response;
}
type RewriterConstructor = new () => Rewriter;

/**
 * Whether a response is a page that should carry a canonical: a successful
 * HTML document that has not asked to stay out of the index.
 */
export function shouldAddCanonical(request: Request, response: Response): boolean {
  if (request.method !== "GET" && request.method !== "HEAD") return false;
  if (response.status !== 200) return false;
  if (!(response.headers.get("content-type") ?? "").includes("text/html")) return false;
  if (/noindex/i.test(response.headers.get("x-robots-tag") ?? "")) return false;
  return true;
}

/**
 * Adds a self-referencing canonical to the `<head>` of an HTML page that does
 * not already declare one there.
 *
 * Streams: the page is not buffered. Returns the response untouched outside
 * the Workers runtime (no `HTMLRewriter`), for anything
 * {@link shouldAddCanonical} rejects, and for paths {@link canonicalUrlFor}
 * gives no canonical.
 *
 * @param request - The visitor's request (its URL is the canonical's source).
 * @param response - The rendered page.
 * @param RewriterImpl - Injected by tests; the global `HTMLRewriter` otherwise.
 */
export function withCanonicalLink(
  request: Request,
  response: Response,
  RewriterImpl: RewriterConstructor | undefined = (globalThis as { HTMLRewriter?: RewriterConstructor }).HTMLRewriter,
): Response {
  if (!RewriterImpl || !shouldAddCanonical(request, response)) return response;
  const href = canonicalUrlFor(request.url);
  if (!href) return response;

  let inHead = false;
  let declared = false;
  return new RewriterImpl()
    .on("head", {
      element(head) {
        inHead = true;
        head.onEndTag((end) => {
          inHead = false;
          if (!declared) end.before(canonicalLinkTag(href), { html: true });
        });
      },
    })
    .on('link[rel="canonical"]', {
      element() {
        // Only a canonical inside <head> counts; one streamed into the body
        // later is ignored by search engines.
        if (inHead) declared = true;
      },
    })
    .transform(response);
}
