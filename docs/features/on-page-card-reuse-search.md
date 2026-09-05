# On-Page Card Reuse Search

Checks whether a page has already been cut into the
[Shared Evidence Library](./evidence-library.md) — first from a manual
"Check this page" box, now also automatically from a browser extension —
before a contributor spends time cutting a duplicate card.

- **Route:** `/cards/library` (the "Check this page" box)
- **Package:** [`debate-research-evidence`](../../packages/debate-search-evidence/README.md)
- **Extension:** [`apps/debate-web-ext`](../../apps/debate-web-ext/README.md)

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
on mount and, when present, pre-fills and auto-runs the check.

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

`apps/debate-web-ext` is an unpacked (not store-published) Manifest V3
browser extension — plain HTML/JS, no bundler, not part of this repo's
`bun`/`turbo` workspaces. Clicking its toolbar icon reads the active tab's
URL and calls a small, dedicated server-backed reuse index —
`GET /api/evidence-reuse-check?url=` (`apps/debate-ai.com/app/api/
evidence-reuse-check/route.ts`, D1-backed, mirroring
`shared-evidence-library.ts`'s `normalizeSourceUrl` matching rules) — so it
answers "has anyone on the team cut this," not just this one browser's own
`localStorage` copy. The web app's own `/cards/library` "Check this page"
box checks the same local-repository match `shared-evidence-library.ts`
always has; the extension is check-only against the shared index and
doesn't register new cards into it (only the web app's Evidence Library
submission form does that).

### Team reuse dashboard

Every `GET /api/evidence-reuse-check` lookup — from the web app's own "Check
this page" box or the extension — now also appends a row to a new
`reuse_check_log` D1 table (`url`, `normalizedUrl`, `alreadyCut`,
`matchCount`, `source` ("web" or "extension"), `checkedAt`), best-effort so a
logging failure never fails the caller's actual check. `GET
/api/evidence-reuse-check/dashboard` reads the log's flagged
(`alreadyCut: true`) rows (capped at the 2000 most recent) and folds them,
via `lib/shared-evidence-library.ts`'s pure `buildReuseCheckDashboard`, into
one ranked row per normalized URL — times flagged, the sources that flagged
it, and when it was last flagged — most frequently flagged first.

`EvidenceLibraryPanel`'s new "Team reuse dashboard" section (backed by
`hooks/useReuseCheckDashboard.ts`) renders this on `/cards/library`, so a
coach can see reuse patterns across the whole team at a glance instead of
the reuse check staying a per-page, on-demand lookup — idea #7's last
previously-open follow-up. It refreshes automatically right after a
successful "Check this page"/shared-index lookup on the same page.

### Options: API base and skip-check whitelist

The extension's Options page (the popup's "Settings" link) has two
settings, both synced via `chrome.storage.sync`:

- **API base URL** — which `debate-ai.com` deployment to check against
  (defaults to `https://debate-ai.com`; only that host and
  `http://localhost:3000` are pre-authorized in `manifest.json`'s
  `host_permissions`).
- **Skip-check whitelist** — idea #7's "An extension options page for
  whitelisting sites" follow-up. One domain per line (e.g. an internal team
  wiki, a general reference site that's never itself a cut card's source).
  Before calling the reuse-check endpoint, the popup checks the active
  tab's hostname against this list (`api.js`'s `isUrlDomainSkipped`, an
  exact or subdomain match) and, when it matches, renders a neutral
  "on your skip-check whitelist" status without a network request at all.

See the extension's own README for install instructions.

## Known gaps

- The extension is unpacked/"Load unpacked" only — no Chrome Web Store or
  Firefox Add-ons listing exists (no store-publishing pipeline in this
  repo).
- The extension has no automated tests of its own (no test runner is wired
  up for this plain-JS, no-bundler extension) — verified manually via "Load
  unpacked". Its request/response shape mirrors
  `evidence-reuse-check-client.ts`, which is Vitest-covered where it's
  authoritative.
- No extension icon set — Chrome shows a generic placeholder toolbar icon.
- The reuse-check log (`reuse_check_log`) is append-only with no retention
  policy or admin purge tool yet — it only grows, and the dashboard endpoint
  guards against unbounded scans with a fixed 2000-row cap rather than a
  real archival strategy.
