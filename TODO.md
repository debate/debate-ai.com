## Tracker Status

_Note: this section (In progress / Completed) previously tracked a long
history of small slices picked up by the standing autonomous-routine prompt
("integrate all the tools into the UI... create user settings and link user
db SQL with the ability to save flows/docs/debates in SQL and link to
users... add tools into where needed in the UI... develop better tool UI").
That history was rebuilt once already after being lost to a bad merge
(`4aa1c03`, "Prod (#863)"), then lost a second time when `2dbb655` ("Update
fmt.Println message from 'Hello' to 'Goodbye'") deleted this whole section
(2,666 lines) under a commit message unrelated to the diff it actually made —
worth a human looking at, since neither the message nor any linked issue
explains the deletion. It is not being reconstructed from memory a second
time — only what's confirmed against the current codebase is recorded from
here on._

### In progress

_No task currently in progress._

### Completed

- **🎞️ Stacked playlists never formed for any video published outside the
  JSON-asset seed — and a re-seed couldn't fix it either.**
  `debate-data-sync/src/videos/video-stacks.ts`'s `assignVideoStacks` only
  ever ran over rows built fresh from the bundled JSON assets
  (`video-rows.ts#buildVideoRows`, driving `seed-videos-to-db.ts`'s full
  seed). A round published through the live YouTube pipeline
  (`publish-round-video.ts#publishRoundVideos`, behind the admin
  "Publish"/"Publish all" actions, and the legacy single-round `POST
  /api/admin/youtube/videos/publish` endpoint the SDK/OpenAPI spec also
  expose) was inserted with no `stack_key`/`stack_position` at all, and
  running a full JSON re-seed never touched it either, since it was never
  part of the JSON assets to begin with — confirmed against
  `content/docs/internals/video-library.mdx`'s own Known gap, which
  understated this as "no stacks until re-seeded" when a re-seed in fact
  never reached these rows at all.

  Generalized `buildVideoStacks`/`assignVideoStacks` to be generic over a new
  `VideoStackRow` (the six fields stacking actually reads/writes) instead of
  requiring a full `VideoRow`, so a bare SQL projection off the `videos`
  table can be stacked directly. Added
  `debate-data-sync/src/videos/video-stack-sql.ts`'s
  `buildVideoStackUpdateStatements` (a `CASE`/`IN` batched `UPDATE` builder,
  mirroring `view-count-sql.ts`'s shape exactly) and
  `apps/debate-ai.com/lib/videos/recompute-video-stacks.ts`'s
  `recomputeVideoStacks(db)`, which re-derives every row's placement over the
  *whole* table (a round and its analysis are commonly published weeks apart
  by different pipelines, so the link can only be found by looking at
  everything at once) and rewrites only what changed. Wired it into both
  publish paths (`publishRoundVideos` and the legacy single-round route) so
  every future publish keeps stacking current on its own, and added
  `POST /api/admin/videos/recompute-stacks` (admin-gated, mirroring
  `/api/admin/videos/seed`'s shape) so a database whose stacks already fell
  behind can be backfilled in one call — safe to re-run, since an
  already-correct row produces no write.

  New tests: `video-stack-sql.test.ts` (the statement builder: both `CASE`
  columns, a `NULL` key, escaping, dedup-keeps-last, row/byte batching);
  `recompute-video-stacks.test.ts` (against a real in-memory SQLite
  `videos` table: links two previously-unstacked rows, links a row to a
  partner added in a later run, no-ops when nothing moved, clears a stack
  once its partner is deleted); a new `publishRoundVideos stacking` suite in
  `publish-round-video.test.ts` (publishing a round links it to an
  already-stored analysis video; nothing runs when nothing was actually
  published). `video-stacks.test.ts`'s existing suite needed no changes —
  the generic signature is satisfied by the same `VideoRow[]` it already
  passed.

  Ran the verification gate: `bun install`; the affected/new test files
  directly (28/28); the wider video-library suite alongside them (47/47);
  `bun run typecheck` (17/17 packages); `bun run test` (506 files, 9431
  tests, repo-wide, all passing); and `bun run build:web` (production build
  succeeded). Docs updated:
  `packages/debate-help-docs/content/docs/internals/video-library.mdx`
  (Known gaps) and a schema comment in `apps/debate-ai.com/lib/database/schema.ts`.

  **Follow-up, deliberately not done here:** no admin UI button calls the new
  `/api/admin/videos/recompute-stacks` endpoint — mirroring
  `/api/admin/videos/seed`, which also has no button in `AdminDashboard.tsx`
  and is only ever called directly (curl, the SDK, or the CLI script). A
  "Recompute stacks" button alongside "Publish all" would be a reasonable
  small follow-up if an admin actually needs the historical backfill rather
  than relying on the now-automatic per-publish recompute.

- **🔄 The Debate Docs workspace's open chat tabs stayed per-browser.**
  `apps/debate-ai.com/components/qwksearch/useChatTabs.ts` keeps
  `qwksearch-open-chat-tabs` — which chat conversations are open as tabs in
  `/doc`'s sidebar, and their titles — in a plain `localStorage` array of
  `{ id, title, hasMessages? }` records. That's exactly the shape
  `TOOL_RECORD_COLLECTIONS` requires (a JSON array under one key, each record
  keyed by a stable string field), but the store had never been added to the
  catalog, so a tab layout built up on one device was invisible after signing
  in on another — the same "per-browser localStorage, not account-synced" gap
  `tool-data-sync.mdx` documents for a dozen other tools. (The chat
  conversation *content* itself is unaffected — it's owned by the
  third-party `research-agent-ui` package's own backend and fetched by id;
  only the tab list and titles were missing a home.)

  Added one entry (`docsChatTabs`) to
  `packages/debate-data-sync/src/state/toolRecordCollections.ts`'s
  `TOOL_RECORD_COLLECTIONS` allowlist — the sync's whole design point is that
  this is enough: `state/tool-record-auto-sync.ts`'s watcher observes any
  catalog entry and pushes/pulls its changes with no edit to `useChatTabs.ts`
  itself. Updated `packages/debate-help-docs/content/docs/internals/tool-data-sync.mdx`'s
  "Which tools sync" table to list it, and added a pinning test to
  `packages/debate-data-sync/test/tool-record-catalog.test.ts` (its
  `EXPECTED_ID_FIELDS` map, and a dedicated `it` asserting the new entry's
  `storageKey`/`idField`/`href`) — the existing
  `packages/debate-videos/test/tool-record-sync-catalog.test.ts` already
  covers that every collection's `href` resolves to a real sidebar link
  (`/doc` does), so nothing there needed changing.

  Ran the verification gate: `bun install`; the two affected test files
  directly (38/38); `packages/debate-videos/test/tool-record-sync-catalog.test.ts`
  plus the rest of `debate-data-sync`'s suite (630/630); `bun run typecheck`
  (17/17 packages); `bun run test` (503 files, 9395 tests, repo-wide, all
  passing); and `bun run build:web` (production build succeeded). No source
  behavior of `useChatTabs.ts` changed — only the catalog and docs.

  ~~**Follow-up, deliberately not done here:** the same `/doc` workspace's
  file browser (`apps/debate-ai.com/components/qwksearch/lib/file-sources.ts`,
  `localStorage` key `REASON-file-sources`) has the identical array-of-records
  shape and is also missing from the catalog, but its records can carry
  plaintext SSH passwords, S3/R2/B2 secret keys and Google OAuth refresh
  tokens (`fileSource-types.ts`'s `FileSource.credentials`). The generic
  `/api/tool-records/[collection]` route only checks for a usable id and
  stores whatever JSON it's handed verbatim — no field-level redaction — so
  adding a plain allowlist entry would put unencrypted storage credentials
  into the shared `saved_tool_records` table. Closing this one needs a
  redaction or encryption pass first (see `editorPreferences`' own precedent
  of deliberately never syncing credentials), not a one-line catalog entry.~~
  **Done:** see the entry below.

- **📝 `Flow Annotations`' "no cloud sync" Known gap was stale — the sync
  already shipped.** `features/flow-annotations.mdx` said "No
  collaborative/live sync — annotations are local `localStorage` only."
  Confirmed false against the current code:
  `packages/debate-practice-drills/src/state/flowAnnotations.ts`'s
  `saveFlowAnnotation`/`deleteFlowAnnotation` already call
  `mirrorToolRecordSave`/`mirrorToolRecordDelete`, `flowAnnotations` is
  already a `TOOL_RECORD_COLLECTIONS` entry (added the same week as this doc
  went stale), and `internals/tool-data-sync.mdx` already lists Flow
  Annotations among the tools that Known gap was closed for. The one thing
  actually missing was `features/flow-annotations.mdx` itself never being
  updated to say so — confirmed by
  `packages/debate-practice-drills/test/tool-record-sync-wiring.test.ts`'s
  pre-existing "flow annotations" suite, which already pins the save+delete
  requests, the still-writes-locally-on-a-500 fallback, and the
  no-request-while-signed-out case; nothing there needed changing.

  Rewrote the doc's Known gaps to describe the real, already-tested
  behavior (with a `~~struck~~` **Fixed:** note, matching this file's own
  convention elsewhere) and linked out to `internals/tool-data-sync.mdx` for
  the gaps that genuinely still apply to every synced tool-record collection
  (per-user, not per-team; next-reload rather than live). Also added the
  mirror hop to the "Data flow" diagram.

  Docs-only change — no source behavior changed, so no new test was needed;
  the existing wiring test already covers the behavior the doc now
  describes. Ran the verification gate: `bun install`; the two affected test
  files directly (21/21); `bun run typecheck` (17/17 packages, including
  `debate-help-docs`' `fumadocs-mdx` MDX compile); `bun run test` (503
  files, 9394 tests, repo-wide, all passing); and `bun run build:web`
  (production build succeeded). Docs updated:
  `packages/debate-help-docs/content/docs/features/flow-annotations.mdx`.

- **🔒 The `/doc` file browser's configured storage backends never synced to
  the account — closing the file-sources follow-up above, with the
  redaction it needed.** `file-sources.ts`'s `REASON-file-sources` store
  (which SSH/S3/R2/B2/Google Docs/Turso sources a user has connected) has the
  catalog's required shape, but a source's `credentials` can hold a plaintext
  SSH password or private key, an S3/R2/B2 secret access key, or a Google
  OAuth refresh token — and `/api/tool-records/[collection]` stores whatever
  JSON a collection hands it verbatim, with no redaction of its own. A plain
  allowlist entry, the way every other collection joins, would have put those
  secrets into `saved_tool_records` unencrypted.

  Gave `ToolRecordCollection` one more, optional field: `redact`, a pure
  `(record) => record` a collection can define to strip fields that must
  never leave this browser. Wired it into all three push sites —
  `mirrorToolRecordSave`/`mirrorToolRecordsSave` (the immediate mirror),
  `hydrateToolRecords`' first-sign-in push of local-only records, and
  `flushToolRecordCollection`'s auto-sync watcher — never into what a tool
  reads back out of its own `localStorage`. Added
  `packages/debate-data-sync/src/state/redact-file-source.ts`'s
  `redactFileSource`: an **allowlist** per `FileSourceType` (host/port/
  username for SSH, region/bucket for S3, …), not a blocklist of
  secret-looking names, so a credential field added to `fileSource-types.ts`
  later defaults to held back rather than defaulting to synced.

  Redacting on the way up only works if the merge doesn't then read the
  account's now-missing field as the account clearing it — the bug a naive
  version of this would have shipped, since `mergeToolRecords` replaces a
  local record wholesale with the account's copy for any id both sides hold.
  Gave it `restoreRedactedFields`: for a `redact`-carrying collection, fills
  back whatever the local copy has that the remote copy doesn't (recursing
  into `credentials` itself), so a password saved on one device survives that
  device's own next reconcile instead of being wiped out by its own redacted
  upload. Added the `fileSources` entry (`idField: "id"`, `href: "/doc"`,
  section "Flowing and writing", alongside the already-synced
  `docsChatTabs`).

  New tests: `redact-file-source.test.ts` (what `redactFileSource` keeps and
  drops per source type, and that it leaves anything not shaped like a File
  Sources record alone); `toolRecordCollections.test.ts` (the redact/restore
  round trip through `mergeToolRecords`, both with a synthetic redact-carrying
  collection and with the real `fileSources` one, plus that a non-redacted
  collection is unaffected); `tool-record-mirror.test.ts` and
  `tool-record-auto-sync.test.ts` (each push site sends the redacted payload,
  not the raw record, including that the watcher's *diff* still runs against
  raw local JSON so a secret-only edit still counts as a change even though
  its redacted payload is identical to what already landed);
  `tool-record-catalog.test.ts` (the new `EXPECTED_ID_FIELDS` entry and a
  pinning test that `fileSources.redact` is actually a function that redacts).
  `debate-videos/test/tool-record-sync-catalog.test.ts`'s existing loop
  already covers `/doc` being a real sidebar destination, so nothing there
  needed changing.

  Ran the verification gate: `bun install`; the five affected/new test files
  directly (113/113); the rest of `debate-data-sync`'s suite plus
  `debate-videos`' catalog cross-check (652/652); `bun run typecheck` (17/17
  packages); `bun run test` (504 files, 9417 tests, repo-wide, all passing);
  and `bun run build:web` (production build succeeded). Docs updated:
  `packages/debate-help-docs/content/docs/internals/tool-data-sync.mdx` (new
  "Redacted fields" section, and the `fileSources` entry in "Which tools
  sync").

  **Follow-up, deliberately not done here:** `redactFileSource` still leaves
  a Google Docs source's `email` and `folderIds` synced, and an SSH source's
  `host`/`port`/`username` — connection metadata, not secrets by themselves,
  but enough to identify *who* a user has connected to without their consent
  if the account were ever compromised. Nothing today reads that as a gap
  (every other collection syncs comparably identifying data, e.g. Opponent
  Team Profiles), so this is a note for a future privacy pass, not a blocker.

# Ideas for New Contributors

_The list below predates this file's numbered-idea tracking convention and
is generic starter material, not audited against the current codebase —
treat entries here as inspiration to investigate, not confirmed gaps. See
"Tracker Status" above for the actual, current state of similarly-themed
work in this repo._

### 1. **Real-time Debate Rooms with WebSockets**
- **Description**: Implement live debate rooms where multiple users can join and debate in real-time with typing indicators, presence, and instant message delivery
- **Tech Stack**: WebSockets (Socket.io or native WS), Redis for pub/sub, React/Vue frontend
- **Difficulty**: Medium-High
- **Good First Issue**: Start with basic room creation/joining, then add real-time messaging

### 2. **AI-Powered Argument Analysis & Feedback**
- **Description**: Build a feature that analyzes debate arguments for logical fallacies, evidence quality, and rhetorical strength, providing constructive feedback
- **Tech Stack**: NLP (spaCy, transformers), OpenAI/Anthropic API or local LLMs, Python/FastAPI backend
- **Difficulty**: High
- **Good First Issue**: Implement fallacy detection for common fallacies (ad hominem, straw man, false dichotomy)

### 3. **Debate Tournament & Bracket System**
- **Description**: Create a tournament mode with brackets, seeding, elimination rounds, and leaderboards for competitive debating
- **Tech Stack**: Database (PostgreSQL/MongoDB), bracket generation algorithms, real-time updates
- **Difficulty**: Medium
- **Good First Issue**: Design the data model for tournaments, matches, and participants

### 4. **Multi-language Debate Support with Translation**
- **Description**: Enable debates across languages with real-time translation, allowing global participation
- **Tech Stack**: Translation APIs (Google Translate, DeepL, or LibreTranslate), i18n framework, language detection
- **Difficulty**: Medium
- **Good First Issue**: Add language selection to user profiles and basic UI translation

### 5. **Argument Visualization & Mind Mapping**
- **Description**: Visual representation of debate structure - claim trees, evidence links, rebuttal chains, and argument maps
- **Tech Stack**: D3.js, Cytoscape.js, or React Flow for interactive graphs, export to image/PDF
- **Difficulty**: Medium-High
- **Good First Issue**: Build a simple claim-evidence tree component with expand/collapse

---

## Additional Ideas (Bonus)

### 6. **Mobile-Responsive PWA with Offline Support**
- Service workers, IndexedDB for offline drafting, push notifications for debate updates

### 7. **Voice Debate Mode**
- Speech-to-text for arguments, text-to-speech for reading opponent arguments, voice activity detection

### 8. **Debate Coaching AI Persona**
- Configurable AI personas (Socratic, Devil's Advocate, Fact-Checker) for practice sessions

### 9. **Evidence Library & Citation Manager**
- Shared evidence database, auto-citation formatting, source credibility scoring

### 10. **Analytics Dashboard for Debaters**
- Personal stats: win rate, fallacy frequency, argument length, topic expertise, improvement trends


11. abiltiy to challenge legends - and speculators bet
12. 

---

## Contribution Guidelines

1. **Pick an issue** or propose your own - comment on the issue to claim it
2. **Start small** - break large features into PR-sized chunks
3. **Write tests** - aim for >80% coverage on new code
4. **Follow code style** - run linting/formatting before submitting
5. **Update docs** - README, API docs, and in-code comments
