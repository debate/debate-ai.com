/**
 * @fileoverview Pure link helpers used by the unified markdown renderer.
 *
 * Split out of the renderer so link classification can be unit tested without
 * mounting React or Streamdown.
 *
 * @module markdown/markdown-links
 */

/**
 * Returns true when the given href is an internal application URL.
 *
 * Internal means the link stays inside the app: an absolute path (`/videos`) or
 * an in-page anchor (`#section`). Anything with a protocol — `http://`,
 * `https://`, `mailto:`, `tel:` — is external, as are relative paths, which the
 * renderer leaves to a plain anchor tag.
 *
 * @param href - The href string to evaluate.
 * @returns Whether the URL is internal (starts with "/" or "#").
 */
export function isInternalUrl(href: string | undefined): boolean {
  if (!href) return false;

  // External URLs (http/https)
  if (href.startsWith("http://") || href.startsWith("https://")) {
    return false;
  }

  // Protocol links (mailto, tel, etc.)
  if (href.includes("://")) {
    return false;
  }

  // Internal links (starting with / or #)
  return href.startsWith("/") || href.startsWith("#");
}

/**
 * Returns true when the href points at an anchor on the current page.
 *
 * @param href - The href string to evaluate.
 * @returns Whether the link is a same-page hash link.
 */
export function isHashLink(href: string | undefined): boolean {
  return typeof href === "string" && href.startsWith("#");
}

/**
 * Extracts the element id a hash link points at.
 *
 * @param href - The href string to evaluate.
 * @returns The target element id, or `null` when the href is not a hash link.
 */
export function getHashTargetId(href: string | undefined): string | null {
  if (!isHashLink(href)) return null;
  const id = href!.substring(1);
  return id.length > 0 ? id : null;
}
