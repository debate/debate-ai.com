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
 * @module app/news/NewsPageContent
 */

"use client"

import { NewsStreamPanel } from "debate-card-search"
import { coachingSessionNews } from "debate-round/src/state/coachingSessions"

export function NewsPageContent() {
  return <NewsStreamPanel extraItems={coachingSessionNews()} />
}
