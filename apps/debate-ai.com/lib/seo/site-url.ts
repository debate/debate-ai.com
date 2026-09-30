/**
 * @fileoverview The site's canonical origin, and the one place a URL is
 * spelled as an absolute address.
 *
 * Search engines are given absolute URLs, not paths: a sitemap's `<loc>`, a
 * `robots.txt` `Sitemap:` line and a page's `alternates.canonical` all need
 * the origin in front of them. Getting it wrong is silent and expensive — a
 * relative canonical resolves against `http://localhost:3000` when the app does
 * not set `metadataBase`, which tells Google the canonical of every video is a
 * development URL.
 *
 * The origin is derived from {@link CANONICAL_HOST}, the constant the Worker's
 * canonical-host redirect already sends every `ebate.app` request to, so there
 * is one answer to "what is this site's address" rather than one per consumer.
 * @module lib/seo/site-url
 */

import { CANONICAL_HOST } from "@/lib/redirects/canonical-host";

/**
 * The origin every absolute URL in metadata and SEO files is built from.
 *
 * `d.ebate.app` and not `debate-ai.com`: the app answers on both, but
 * `debate-ai.com` is the registration domain while `d.` is the host the
 * canonical-host redirect standardises on, so metadata here names the same host
 * inbound links are consolidated to.
 */
export const SITE_ORIGIN = `https://${CANONICAL_HOST}`;

/**
 * Turns a site-relative path into an absolute URL for a sitemap `<loc>`, a
 * `robots.txt` `Sitemap:` line or an Open Graph image.
 *
 * A path that is already absolute is returned unchanged, so a caller that has a
 * full URL in hand does not have to know which form it arrived in.
 *
 * @param path - A path beginning with `/`, or an absolute URL.
 * @returns e.g. `https://d.ebate.app/videos`.
 */
export function absoluteUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  return `${SITE_ORIGIN}${path.startsWith("/") ? path : `/${path}`}`;
}
