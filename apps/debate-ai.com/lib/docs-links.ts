/**
 * @fileoverview Links from the app into the Fumadocs documentation site
 * (`packages/debate-help-docs`).
 *
 * Every tool page header (`components/tools/ToolPageHeader.tsx`) and both
 * workspace hubs (`components/research/ResearchHub.tsx`,
 * `components/coach/CoachHub.tsx`) link to the long-form doc for what's on
 * screen. Those docs are published from `packages/debate-help-docs/content/docs`
 * — `features/*.mdx` mirrors `docs/features/*.md`, and `guides/*.mdx` are the
 * task-oriented walkthroughs of the training, practice, and research
 * collaboration tools.
 *
 * The deployed docs site's origin is an environment concern, not a code
 * one: set `NEXT_PUBLIC_DOCS_URL` (e.g. `https://docs.debate-ai.com`) and
 * every link resolves to the live site. Without it, links fall back to the
 * same `.mdx` source rendered on GitHub, so a fresh checkout never links to
 * a 404.
 *
 * @module lib/docs-links
 */

import { APP_FEATURES } from "./ui/features/feature-catalog"

/** Origin of the deployed Fumadocs site, without a trailing slash; empty when unset. */
export const DOCS_SITE_URL = (process.env.NEXT_PUBLIC_DOCS_URL ?? "").replace(/\/+$/, "")

/** Where the docs site's content lives on GitHub, for the no-deployment fallback. */
const DOCS_SOURCE_URL =
  "https://github.com/debate/debate-ai.com/blob/master/packages/debate-help-docs/content/docs"

/** The task-oriented guides under `content/docs/guides/`. */
export type DocsGuide = "training-tools" | "practice-tools" | "research-collaboration"

/** Short label for each guide, used as the eyebrow over a tool page's title. */
export const DOCS_GUIDE_LABELS: Record<DocsGuide, string> = {
  "training-tools": "Training tool",
  "practice-tools": "Practice tool",
  "research-collaboration": "Research collaboration",
}

/** Title of each guide page, for link text. */
export const DOCS_GUIDE_TITLES: Record<DocsGuide, string> = {
  "training-tools": "Training tools guide",
  "practice-tools": "Practice tools guide",
  "research-collaboration": "Research collaboration guide",
}

/**
 * URL of one docs page, given its path under `content/docs/` without the
 * extension (e.g. `"features/drill-sets"`, `"guides/training-tools"`).
 *
 * @param path - Docs path, without a leading slash or `.mdx`.
 */
export function docsPageUrl(path: string): string {
  const clean = path.replace(/^\/+/, "").replace(/\.mdx?$/, "")
  return DOCS_SITE_URL ? `${DOCS_SITE_URL}/docs/${clean}` : `${DOCS_SOURCE_URL}/${clean}.mdx`
}

/** URL of the docs site's landing page (or the docs folder on GitHub). */
export function docsHomeUrl(): string {
  return DOCS_SITE_URL ? `${DOCS_SITE_URL}/docs` : DOCS_SOURCE_URL
}

/**
 * URL of one of the task guides.
 *
 * @param guide - Which guide.
 */
export function guideDocsUrl(guide: DocsGuide): string {
  return docsPageUrl(`guides/${guide}`)
}

/**
 * URL of the feature doc for an in-app route, if the feature catalog
 * (`lib/ui/features/feature-catalog.ts`) records one for it.
 *
 * @param href - In-app route, e.g. `"/drills"`.
 */
export function featureDocsUrlForRoute(href: string): string | undefined {
  const entry = APP_FEATURES.find((feature) => feature.href === href)
  if (!entry?.doc) return undefined
  return docsPageUrl(`features/${entry.doc}`)
}
