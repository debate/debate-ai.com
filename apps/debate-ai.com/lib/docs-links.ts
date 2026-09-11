/**
 * @fileoverview Links from the app into the Fumadocs documentation site
 * (`packages/debate-help-docs`).
 *
 * Every tool page header (`components/tools/ToolPageHeader.tsx`) and both
 * workspace hubs (`components/research/ResearchHub.tsx`,
 * `components/coach/CoachHub.tsx`) link to the long-form doc for what's on
 * screen. Those docs are published from `packages/debate-help-docs/content/docs`
 * — `features/*.mdx` is the user-facing page per feature, `internals/*.mdx`
 * the engineering note behind it, and `guides/*.mdx` are the
 * task-oriented walkthroughs of the training, practice, and research
 * collaboration tools.
 *
 * Those docs ship with the app. `scripts/build-docs.mjs` static-exports the
 * docs site into `public/docs` on every build, so the Worker serves it at
 * `/docs` on whatever origin the app is running on — which is why every link
 * below is a same-origin path by default and needs no configuration.
 *
 * `NEXT_PUBLIC_DOCS_URL` overrides that origin for the case where the docs
 * are deployed separately (e.g. `https://docs.debate-ai.com`). It only
 * replaces the origin: the docs site is served under `/docs` there too, so
 * the rest of the path is the same either way.
 *
 * @module lib/docs-links
 */

import { APP_FEATURES } from "./ui/features/feature-catalog"

/**
 * Origin of a separately-deployed Fumadocs site, without a trailing slash.
 * Empty by default, which leaves every link same-origin — the docs are built
 * into this app's own `public/docs` (see `scripts/build-docs.mjs`).
 */
export const DOCS_SITE_URL = (process.env.NEXT_PUBLIC_DOCS_URL ?? "").replace(/\/+$/, "")

/** Path the docs site is served under, on this origin or an override origin. */
const DOCS_BASE_PATH = "/docs"

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
  return `${DOCS_SITE_URL}${DOCS_BASE_PATH}/${clean}`
}

/** URL of the docs site's home page. */
export function docsHomeUrl(): string {
  return `${DOCS_SITE_URL}${DOCS_BASE_PATH}`
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
