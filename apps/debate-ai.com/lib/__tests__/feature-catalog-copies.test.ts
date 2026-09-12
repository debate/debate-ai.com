/**
 * @fileoverview Guards the exact drift class `features-page.mdx`'s Known gaps
 * section already documents happening once: `APP_FEATURES` is hand-maintained
 * in three places — this app, `packages/debate-ui` (the original seed copy,
 * no longer rendered), and `packages/debate-contributor-progress` (News
 * Stream's auto-generated "Tool spotlight" posts) — because none of the three
 * packages has a dependency edge that would let one `import` the others'
 * copy (`debate-ui` is deliberately not a runtime dependency of the app or of
 * `debate-community`). `/contacts` was once added to this app's copy but
 * missed the other two, and nothing caught it because each copy's own test
 * suite only checks its own internal consistency.
 *
 * A *test-only* relative import here doesn't add that dependency edge —
 * nothing under `lib/__tests__` ships in a bundle — so this file reads all
 * three copies directly and fails the next time one gains, loses, or edits an
 * entry the others don't share.
 */
import { describe, expect, it } from "vitest"

import { APP_FEATURES as LIVE_APP_FEATURES } from "../ui/features/feature-catalog"
// Relative imports into sibling packages, not package-name imports: neither
// package is (or should become) a runtime dependency of this app. See the
// fileoverview above and `features-page.mdx`'s "Three copies, hand-synced".
import { APP_FEATURES as DEBATE_UI_APP_FEATURES } from "../../../../packages/debate-ui/src/features/feature-catalog"
import { APP_FEATURES as COMMUNITY_APP_FEATURES } from "../../../../packages/debate-contributor-progress/src/ui/features/feature-catalog"

const COPIES = [
  { name: "packages/debate-ui (seed copy)", entries: DEBATE_UI_APP_FEATURES },
  { name: "packages/debate-contributor-progress (News Stream)", entries: COMMUNITY_APP_FEATURES },
]

describe("APP_FEATURES hand-synced copies", () => {
  it.each(COPIES)("$name matches the live app catalog's routes and ids", ({ entries }) => {
    const liveIds = LIVE_APP_FEATURES.map((f) => f.id).sort()
    const liveHrefs = LIVE_APP_FEATURES.map((f) => f.href).sort()
    expect(entries.map((f) => f.id).sort()).toEqual(liveIds)
    expect(entries.map((f) => f.href).sort()).toEqual(liveHrefs)
  })

  it.each(COPIES)("$name matches the live app catalog's content for every shared id", ({ entries }) => {
    const liveById = new Map(LIVE_APP_FEATURES.map((f) => [f.id, f]))
    for (const feature of entries) {
      const live = liveById.get(feature.id)
      expect(live, `no live entry for id "${feature.id}"`).toBeDefined()
      // `doc` and `featureDocUrl`'s base URL deliberately differ between the
      // live app (an in-app `/docs/...` route) and the other two copies (a
      // GitHub blob URL) — see `featureDocUrl` in each file — so this checks
      // everything that should read identically to a user: title,
      // description, route, category, and search tags.
      expect(feature.title).toBe(live!.title)
      expect(feature.description).toBe(live!.description)
      expect(feature.href).toBe(live!.href)
      expect(feature.category).toBe(live!.category)
      expect(feature.tags).toEqual(live!.tags)
    }
  })
})
