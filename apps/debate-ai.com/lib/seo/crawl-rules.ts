/**
 * @fileoverview Which paths a crawler is told to skip.
 *
 * Kept out of `app/robots.ts` so the list can be unit-tested — a `robots.txt`
 * that quietly stops matching the site is not something to find out about from
 * a crawler.
 *
 * ## The rule the list follows
 *
 * Disallow a path when it needs a signed-in session to render anything, or
 * when it is API surface. Leave alone every path that renders for a stranger.
 *
 * That distinction is why this file is not a list of top-level prefixes. A
 * blanket `Disallow: /practice/` would look tidier and would be wrong: the
 * library's three reference views — the glossary, the rankings and the
 * statistics — moved under `/practice` when their sidebar category was
 * reorganised, and they are public content that `lib/seo/sitemap.ts` lists.
 * The tool destinations are therefore read off the sidebar's own link data
 * (`SIDEBAR_TOOL_SECTIONS`) rather than restated, so a tool added there is
 * disallowed here without anyone remembering this file, and a public page moved
 * under the same category is not swept up with it.
 * @module lib/seo/crawl-rules
 */

import { SIDEBAR_TOOL_SECTIONS, VIDEO_REFERENCE_LINKS } from "@debate/videos";

/**
 * The per-user surfaces: the REASON document workspace, the round workspace,
 * the editor, and the app's own saved-work pages.
 *
 * These are not in `SIDEBAR_TOOL_SECTIONS` because they are reached from the
 * app dock or a document rather than from the tool tree, but they are as
 * account-bound as anything in it.
 */
const WORKSPACE_PREFIXES: readonly string[] = [
  "/research/docs",
  "/debate",
  "/reason-editor",
  "/outline",
  "/summaries",
  "/speech-documents",
  "/annotations",
  "/word-count",
];

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
 * The tool tree's own destinations — the Research, Practice and Coaching
 * sections and every tool in them.
 *
 * Two hrefs carry a fragment (`/practice/partners#judge`); robots.txt matches
 * on the path, so the fragment is dropped and the path is used.
 *
 * The section headings' own hrefs (`/research`, `/practice`, `/coaching`) are
 * the "flagship tool", and the same href is already one of the section's
 * tools — so they arrive here once, not twice.
 */
function toolHrefs(): string[] {
  const hrefs = new Set<string>();
  for (const section of SIDEBAR_TOOL_SECTIONS) {
    hrefs.add(section.href);
    for (const tool of section.tools) {
      hrefs.add(tool.href.split("#")[0]);
    }
  }
  return [...hrefs].filter(Boolean).sort();
}

/**
 * The public pages that sit under a tool section's own path.
 *
 * `robots.txt` matches prefixes, so a `Disallow: /practice` would take the
 * library's reference views with it. Each of these needs an `Allow` that
 * outranks the section's `Disallow`, which is what {@link ALLOW_OVERRIDES} is
 * for.
 */
const ALLOW_OVERRIDES: readonly string[] = VIDEO_REFERENCE_LINKS.map((link) => link.href);

/**
 * The `Disallow` list, as `robots.txt` path prefixes.
 *
 * Sorted so the file this produces is stable between requests, which keeps it
 * cacheable and makes a diff between two builds readable.
 */
export const DISALLOWED_PATHS: readonly string[] = [
  ...API_PREFIXES,
  ...ACCOUNT_PATHS,
  ...WORKSPACE_PREFIXES,
  ...toolHrefs(),
].sort();

/**
 * Public paths stated as explicit `Allow` rules.
 *
 * Needed only where a `Disallow` prefix above would otherwise swallow them:
 * `robots.txt` resolves an `Allow`/`Disallow` conflict by preferring the more
 * specific match, so naming the reference views here outranks the `/practice`
 * prefix while leaving the tools beside them disallowed.
 */
export const ALLOWED_PATHS: readonly string[] = [
  "/",
  ...ALLOW_OVERRIDES,
].sort();
