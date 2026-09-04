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
 * Also wires `useNewsStreamSync` into the panel's `syncRemote` prop, so a
 * signed-in user's read/liked state follows them across devices instead of
 * staying stuck in one browser (`docs/features/news-stream.md`'s "Read/like
 * state is per-browser" Known gap).
 *
 * @module app/news/NewsPageContent
 */

"use client"

import { NewsStreamPanel } from "debate-community"
import { coachingSessionNews } from "debate-practice-rounds/src/state/coachingSessions"
import { useNewsStreamSync } from "@/lib/hooks/useNewsStreamSync"

export function NewsPageContent() {
  const syncRemote = useNewsStreamSync()
  return <NewsStreamPanel extraItems={coachingSessionNews()} syncRemote={syncRemote} />
}
