/**
 * @fileoverview Client wrapper around `NewsStreamPanel` — split out of
 * `page.tsx` because `page.tsx` needs to stay a server component to export
 * `metadata`, but composing `debate-round`'s `coachingSessionNews()` into
 * the feed needs a live (client-side) `localStorage` read.
 *
 * Calling `coachingSessionNews()` directly in this render body (rather than
 * deferring it to a `useEffect`) is safe here: it reads `[]` during SSR (no
 * `localStorage`) and the real, persisted sessions once this client
 * component hydrates in the browser, and `NewsStreamPanel` itself never
 * renders `extraItems` into the DOM before its own mount effect runs (it
 * shows a "Loading…" state either way), so there's no hydration mismatch —
 * see `NewsStreamPanel.tsx`'s fileoverview for how it threads the value
 * through a ref rather than an effect dependency.
 *
 * Also folds in `buildAutoFeatureNews(APP_FEATURES)` — the "Tool spotlight"
 * posts. The catalog lives in this package, which depends on
 * `@debate/community`, so the feed can't import it and takes it as `extraItems`.
 *
 * Also wires `useNewsStreamSync` into the panel's `syncRemote` prop, so a
 * signed-in user's read/liked state follows them across devices instead of
 * staying stuck in one browser (`packages/debate-help-docs/content/docs/internals/news-stream.mdx`'s "Read/like
 * state is per-browser" Known gap).
 *
 * @module app/news/NewsPageContent
 */

"use client"

import { NewsStreamPanel } from "@debate/community"
import { buildAutoFeatureNews } from "@debate/community/src/lib/news-stream"
import { coachingSessionNews } from "@debate/practice-rounds/src/state/coachingSessions"
import { APP_FEATURES } from "../../lib/feature-catalog"
import { useNewsStreamSync } from "../../lib/hooks/useNewsStreamSync"

// Module-level: the catalog is static, so the spotlights never change.
const FEATURE_SPOTLIGHTS = buildAutoFeatureNews(APP_FEATURES)

export function NewsPageContent() {
  const syncRemote = useNewsStreamSync()
  return <NewsStreamPanel extraItems={[...FEATURE_SPOTLIGHTS, ...coachingSessionNews()]} syncRemote={syncRemote} />
}
