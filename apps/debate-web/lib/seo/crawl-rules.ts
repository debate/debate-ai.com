/**
 * @fileoverview Which paths a crawler is told to skip.
 *
 * Kept out of `app/robots.ts` so the list can be unit-tested — a `robots.txt`
 * that quietly stops matching the site is not something to find out about from
 * a crawler.
 *
 * ## The rule the list follows
 *
 * Disallow only what is private or not a page: the API, sign-in and its OAuth
 * callbacks, and the account pages (settings, notifications, contacts, admin).
 * Everything else is crawlable.
 *
 * The list used to also disallow every tool in the sidebar and every per-user
 * workspace (`/research`, `/coaching`, `/news`, `/practice/*`,
 * `/reason-editor`, …), with `Allow` overrides for the reference pages under
 * them. That hid most of the site from search, and the overrides named the
 * same paths as the `Disallow`s they were meant to beat (`/practice/rules`
 * appeared as both), which crawlers resolve inconsistently. Those pages all
 * render for a signed-out visitor, so they are left to the canonical tags
 * (`lib/seo/canonical-link.ts`) rather than blocked.
 * @module lib/seo/crawl-rules
 */

/** The API surface, and the Scalar HTML reference page it serves at `/api`. */
const API_PREFIXES: readonly string[] = ["/api"];

/** Sign-in, the OAuth callbacks behind it, and the account pages. */
const ACCOUNT_PATHS: readonly string[] = [
  "/auth",
  "/login",
  "/settings",
  "/admin",
  "/notifications",
  "/contacts",
];

/**
 * The `Disallow` list, as `robots.txt` path prefixes.
 *
 * Sorted so the file this produces is stable between requests, which keeps it
 * cacheable and makes a diff between two builds readable.
 */
export const DISALLOWED_PATHS: readonly string[] = [...API_PREFIXES, ...ACCOUNT_PATHS].sort();

/** Public paths stated as explicit `Allow` rules: the site as a whole. */
export const ALLOWED_PATHS: readonly string[] = ["/"];
