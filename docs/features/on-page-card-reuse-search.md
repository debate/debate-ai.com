# On-Page Card Reuse Search

Checks whether a page has already been cut into the
[Shared Evidence Library](./evidence-library.md) — first from a manual
"Check this page" box, now also automatically from a browser extension —
before a contributor spends time cutting a duplicate card.

- **Route:** `/cards/library` (the "Check this page" box), plus a
  `?checkUrl=` query param the extension deep-links into.
- **Package:** [`debate-card-search`](../../packages/debate-card-search/README.md)
- **Extension:** [`extension/card-reuse-checker`](../../extension/card-reuse-checker/README.md)

## What it does

`lib/shared-evidence-library.ts`'s `normalizeSourceUrl` /
`findEntriesBySourceUrl` / `checkPageForExistingCards` /
`buildPageReuseCheckSummaryText` check a given page URL against every
persisted `EvidenceLibraryEntry.sourceUrl`, matched after stripping scheme,
a leading `www.`, tracking query parameters, and a trailing slash so minor
URL differences don't defeat a real match. `state/evidenceLibraryEntries.ts`'s
`checkPersistedPageForExistingCards` composes that against the real
persisted repository.

`EvidenceLibraryPanel`'s "Check this page" box (on `/cards/library`) lets a
contributor paste a URL and see the result. The same box also reads an
optional `checkUrl` query param (via `next/navigation`'s `useSearchParams`)
on mount and, when present, pre-fills and auto-runs the check — this is what
the browser extension deep-links into.

## Check history

Every local check (manual or `?checkUrl=` deep-linked) is now also recorded
to a small history log instead of only showing the latest lookup's result —
`state/reuseCheckHistory.ts`'s `appendReuseCheckHistory`/`listReuseCheckHistory`
store the last `MAX_REUSE_CHECK_HISTORY` (20) checks in localStorage
(URL, already-cut/new, match count, timestamp), oldest entries trimmed once
the cap is exceeded — mirrors `state/judgeDecisions.ts`'s
append-only-with-cap shape. `EvidenceLibraryPanel` renders this as a "Recent
checks" list under the box; clicking an entry re-runs that same check, and a
"Clear history" action removes the whole log
(`clearReuseCheckHistory`). Only the local (this browser's own repository)
outcome is recorded, not the async team-wide shared-index result below —
a future run could add a second record once that resolves, if useful.

## The browser extension

`extension/card-reuse-checker` is an unpacked (not store-published)
Manifest V3 browser extension. Clicking its toolbar icon reads the active
tab's URL and opens `/cards/library?checkUrl=<that URL>` in a new tab —
running the exact same check the manual box runs, just without having to
copy/paste the URL yourself.

It can't call the check directly: the evidence repository is persisted in
`debate-ai.com`'s own browser localStorage, a different origin the
extension has no access to, and this repo has no server-side API for the
evidence library. `lib/shared-evidence-library.ts`'s `buildReuseCheckDeepLink`
builds the deep-link URL; the extension's `deep-link.js` keeps a
plain-JS mirror of that same function in sync (no build step exists to
import the TypeScript package directly). See the extension's own README for
install and settings instructions (it defaults to `https://debate-ai.com`,
overridable in its Options page for a self-hosted or local-dev deployment).

## Known gaps

- The extension is unpacked/"Load unpacked" only — no Chrome Web Store or
  Firefox Add-ons listing exists (no store-publishing pipeline in this
  repo).
- The extension has no automated tests of its own — Chrome-extension-API
  code isn't exercisable in this repo's Vitest/jsdom setup. Its
  `buildReuseCheckDeepLink` logic is Vitest-covered where it's authoritative,
  in `packages/debate-card-search/test/shared-evidence-library.test.ts`.
- No extension icon set — Chrome shows a generic placeholder toolbar icon.
