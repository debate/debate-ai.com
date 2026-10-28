# CLAUDE.md — `debate-research-evidence` (`packages/debate-search-evidence`)

**Package name:** `debate-research-evidence` — filter on that, not the
directory. Public (`@debate-ai/` scope). Entry `src/index.ts`, tests in `test/`. One of the two
load-bearing packages in the repo.

Owns the evidence card research interface (search bar, result list, card content
viewer, research and AI-analysis sidebars) plus the shared **evidence/argument
library**, **LLM card scoring**, revision incentives, the **review queue**, and
the topic coverage dashboard.

## You are the foundation

`debate-contributor-progress` (`debate-community`) and
`debate-team-collaboration` were both split out of the old `debate-card-search`
and **still build on this package**. A change to a public export or to the
shared library's shape reaches both. Check them before renaming anything.

## Rules

- **LLM card scoring decides what debaters see first.** A scoring change
  reorders the whole corpus for everyone; treat it as a product decision, pin
  the behaviour in a test, and say so in the PR.
- **The review queue is a moderation surface.** Cards move between states based
  on community review; never add a transition that bypasses review, and never
  make a rejection silently reversible.
- Revision incentives feed `debate-community`'s leaderboard — a change in what
  counts as a contribution changes everyone's standing.
- Card content is user-submitted and can be hostile. It is rendered widely;
  sanitize at the boundary, not at each render site.
- **The source-article panel talks to qwksearch.com.** `CardContentViewer`
  finds a card's source URL (`lib/card-source-url.ts`) and
  `SourceArticlePanel` fetches its full text from qwksearch's
  extract-webpage endpoint (`lib/source-article.ts`, always passing
  `baseUrl` — the api-client otherwise resolves against debate-ai.com) and
  renders it with research-agent-ui's `ArticleContent`. That import is lazy
  and must keep setting the `Prism` and `NEXT_PUBLIC_BASE_URL` globals first,
  for the reasons in debate-webview's `routes/doc/ResearchAgentEmbed.tsx`;
  dropping either breaks /doc, not this screen. `ArticleContent` does not
  sanitize the extracted `cite`, so the panel does.

## `src/caselist/` — the openCaselist sync

Moved here from the removed `debate-data-sync` package. CLIs: `bun run download-caselist`,
`grab-caselist` and `sync-caselist` from this package.

- **The downloads page is client-rendered.** A plain GET of
  `/{slug}/downloads` returns the React shell with no archive links in it, which
  is why `fetchCaselistDownloads` tries the API, then the page, then a probe of
  the bucket's generated URLs, and reports which one answered. Do not "simplify"
  that to one source.
- **Nothing hardcodes a caselist.** `hspolicy26`, `hsld26`, `hspf26`,
  `ndtceda26` and `nfald26` all serve the same markup and the same bucket
  layout; a new season is a bump of `CURRENT_SEASON`. If you find yourself
  writing a slug into a parser, it belongs in `caselist-config.ts`.
- **DOCX conversion is `debate-card-parser`'s, not ours.** `caselist-archive.ts`
  owns only what is specific to a bulk archive — scale, provenance and partial
  failure. Don't grow a second DOCX parser here.
- **`collectDocxEntries` is the wrong tool for these archives.** It caps an
  upload at 100 files and buffers every entry at once; a season dump is
  thousands of documents and hundreds of megabytes. `loadCaselistArchive`
  streams instead. Keep it that way. In the browser, use
  `loadRemoteCaselistArchive` (HTTP Range reads via `remote-zip.ts`): even
  `arrayBuffer()` on a 1–2 GB dump fails before JSZip ever sees it.
- **Provenance degrades to `null`, never to a guess.** The school, team and side
  read out of an entry path are what an ingested card is credited to.
- An archive is recorded as synced only after its ingest succeeds, so a failed
  run retries exactly that archive.

## `src/account-sync/` is the account sync, and it is load-bearing

`src/account-sync/` (moved here from the removed `debate-data-sync` package) holds the sync every tool's
`localStorage` store rides on. Working in here:

- **`TOOL_RECORD_COLLECTIONS` is the whole contract.** A collection in that list
  syncs — `tool-record-auto-sync.ts` watches it and needs no per-package
  wiring. That also makes a bad entry silent: a duplicated `key` merges two
  tools' account rows, and a mistyped `idField` makes every record in that
  store fail validation, so the tool keeps working locally and simply never
  syncs. `test/account-sync/tool-record-catalog.test.ts` is what catches both — don't add an
  entry without checking the owning store's actual id field.
- **Keep this layer framework-free.** The route, the client and the tests all
  import `toolRecordCollections.ts`, and `sign-in-prompt.ts` is imported by tool
  packages that have no DOM in their tests. No React, no `next/*`, and no
  `fetch` outside `tool-records-client.ts`.
- **Never let a sync failure block a local write.** A mirror call returns
  immediately and swallows its error; a store applies locally first, always.
- **Sample records never sync.** `sampleRecords.ts` seeds the demo "Load
  sample data" records into tool stores and lists their ids in a manifest;
  the auto-sync snapshot, `mirrorToolRecordsSave` and hydrate's push all skip
  them via `isSampleToolRecord`. A new path that pushes local records must
  skip them too.
- **Never advance a snapshot past a write that did not land.** That is the one
  bug the watcher cannot have — the record would be dropped with no error
  anywhere.
- **Large data goes in `bulk-storage.ts`, not `localStorage`.** Flows, rounds
  and flow history live in IndexedDB (mirrored into the browser extension's
  unlimited storage when installed); `localStorage` is for small preferences.
  Writes never throw and never surface a quota error. Its key list and message
  type are duplicated in the extension's bridge — change both together. See
  `content/docs/architecture/offline-storage.md` in `debate-help-docs`.
- **Single-object stores join through a codec.** `flowEditorDisplaySettings`
  wraps `debate-flow`'s display object as one record
  (`flow-editor-settings-codec.ts`); `flowKeymap` wraps the keymap object as one
  record per rebound action (`flow-keymap-codec.ts`). `debate-flow` itself is
  untouched. The display collection's `redact` is an **allowlist**
  (`SYNCED_FLOW_DISPLAY_FIELDS`), so a new field stays on-device until listed.

## `src/routes/category-paths.ts`

The old-path → new-path table for the category regrouping, read by the Worker's
redirects, `debate-round`'s starred tools and the recent-tools lists. It lives here
because this is the lowest package all of those already depend on (`debate-editor`
depends on this package only for this file and the account sync).
