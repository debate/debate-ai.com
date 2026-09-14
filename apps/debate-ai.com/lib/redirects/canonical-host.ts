/**
 * @fileoverview The canonical-host redirect.
 *
 * One call at the very top of the Worker's `fetch`:
 *
 *     const redirect = handleCanonicalHostRedirect(request);
 *     if (redirect) return redirect;
 *
 * It returns a `Response` only when the request arrived on a host that is not
 * the canonical one, and `null` for every other request — which is all of them
 * on `d.ebate.app`, on `debate-ai.com`, on preview deployments and in dev.
 *
 * Why the short domain redirects and `debate-ai.com` does not: `ebate.app` is
 * served from the `d.` subdomain, so the apex (and its `www.` form) exists only
 * to send visitors there. `debate-ai.com` is still a host this app answers on
 * in its own right (see `lib/auth/hosts.ts`), so it is deliberately absent from
 * the list below.
 */

/** The host every redirected request is sent to. */
export const CANONICAL_HOST = "d.ebate.app";

/**
 * Hosts that redirect to {@link CANONICAL_HOST}, matched on the full host
 * including port. The `www.` form is listed alongside the apex because it is
 * the same domain with a prefix — a visitor typing either lands on `d.`.
 */
export const REDIRECTED_HOSTS = ["ebate.app", "www.ebate.app"];

/**
 * 308, not 301: a permanent redirect that preserves the method and body, so a
 * `POST /api/...` that happens to arrive on the apex is replayed intact rather
 * than silently downgraded to a `GET` with its body dropped.
 */
const REDIRECT_STATUS = 308;

/**
 * Builds the redirect for one request, or returns `null` to let the app serve
 * it as usual.
 *
 * The path, query string and (browser-side) fragment are carried over
 * unchanged, so a deep link keeps working across the hop.
 */
export function handleCanonicalHostRedirect(request: Request): Response | null {
  let url: URL;
  try {
    url = new URL(request.url);
  } catch {
    // Not a URL we can reason about; leave the request alone.
    return null;
  }

  if (!REDIRECTED_HOSTS.includes(url.host.toLowerCase())) return null;

  const target = new URL(url.toString());
  target.host = CANONICAL_HOST;
  // The apex is only ever served over HTTPS in production; pin the scheme so a
  // plain-HTTP hop does not land the visitor on an insecure canonical URL.
  target.protocol = "https:";
  target.port = "";

  return new Response(null, {
    status: REDIRECT_STATUS,
    headers: {
      location: target.toString(),
      // The redirect is a property of the host, not of anything per-visitor,
      // so it is safe for shared caches to keep.
      "cache-control": "public, max-age=3600",
    },
  });
}
