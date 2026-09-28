
integrate all the tools and create user settings and link user db SQL with
ability to save flows docs and debates in SQL and link to users. add tools
into where needed in the ui for users and develop better tool ui

Investigated before picking a slice: this codebase's tool-sync
infrastructure is already exceptionally mature — nearly every tool in
`packages/debate-webview/src/routes/tools/tool-groups.ts` already
persists to the cloud, either via a dedicated table+hook or the generic
`TOOL_RECORD_COLLECTIONS` catalog (~60 collections,
`packages/debate-data-sync/src/state/toolRecordCollections.ts`), each
D1 table already has a proper `userId` foreign key with cascade delete
(see `apps/debate-ai.com/lib/database/schema.ts`), and `/tools`' "My
Saved Items" widget (`MySavedItems.tsx`) already acts as the de facto
"link flows/docs/debates to users, browsable in one place" surface idea
#17 named, merging ~20 data kinds via `debate-round`'s
`state/cloudLibrary.ts`. Do not re-build any of that sync infrastructure
without re-checking first — see that module's own "joined next" history
comment for the full, current list of what's already wired.

Done (this run, infra): before any of the above could even be verified,
three separate build/install blockers had to be fixed first —
- `apps/debate-ai.com/drizzle/` was deleted from mainline a 4th time by
  an unreviewed direct commit (`1a2cbbf`, "Delete apps/debate-ai.com/drizzle
  directory"), undoing the prior restore in `de88ca2`. Restored again from
  `de88ca2`, then `bun run db:generate` picked up real schema drift since
  that restore (the team-roster/tiered-limits feature's `team_assignments`,
  `team_students`, `usage_counters` tables) as migration
  `0038_stiff_sue_storm.sql`. If this keeps recurring, the real fix is
  branch protection on this path or CI enforcement, not another restore —
  flagging as a good follow-up for whoever owns repo settings.
- `bun.lock` had unresolved git merge-conflict markers left over from a
  bad merge commit (`4ded2f6`), so `bun install --frozen-lockfile` failed
  outright with a JSON parse error before anything else could run.
  Resolved the 3 conflict blocks.
- `apps/debate-browser-ext/wxt.config.ts`'s `next/link` / `next/navigation`
  / `next/image` aliases still pointed at `packages/debate-ai-webui`, that
  package's name before its rename to `debate-webview` (`3811cc9`), failing
  `bun run build` outright for `debate-web-ext`. Fixed the alias and two
  stale references in that app's own README.
With all three fixed, `bun run typecheck` (25/25), `bun run test` (10620
passed, 1 skipped), and `bun run build` all pass clean.

Done (this run, `/settings`): resolved the "re-duplicate sync status or
just link?" deferred decision below by doing a bit of both — a new
`ToolsDataSection` (`packages/debate-webview/src/components/settings/`)
in the Preferences tab, alongside `PlanUpgradeSection` and
`TeamCoachingSection`, shows a compact synced/syncing/N-failed status line
off the same `useToolRecordSync` state `/tools`' `ToolSyncStatusPanel`
already uses, plus a link to `/tools` for the full per-tool retry list and
"My Saved Items" browser. Deliberately does not list failing tools by
name itself, so `/tools` stays the one place that owns that detail. Tests:
`packages/debate-webview/test/components/settings/ToolsDataSection.test.tsx`.

Still open, intentionally deferred:
- No per-item delete/manage affordance in "My Saved Items" itself
  (deletion, where it exists, lives inside each tool's own panel) — a
  real gap, but a UI-design-sized one (bulk delete? per-kind? confirm
  dialogs for ~21 different record shapes?) rather than a small slice.
- The REASON editor's file tree (`packages/debate-editor`, upstream-synced
  via `scripts/sync-upstream.mjs`) still has no sample-data empty state,
  unlike Coach Materials/My Saved Items/Evidence Library/Practice Drills
  below. Riskier than those: any change needs to land in one of the ~35
  "ours" override files the sync script tracks, not the ~365 files copied
  from upstream each build, or it will be silently overwritten.

Done (first slice, Coach Materials): of that ~20-kind list, Coach
Materials (`saved_coach_materials`, `/coach-materials`) was a genuine
miss — synced to the account but never surfaced in "My Saved Items,"
unlike everything else. It's the 21st kind now. Unlike the other 20,
`CoachMaterial` itself carried no `updatedAt`/`createdAt` field at all,
so `GET /api/coach-materials` now mixes the saved row's own `updatedAt`
(already tracked by the PUT route on every upsert) into each listed
material — see `CloudCoachMaterialSummary` in `cloudLibrary.ts` and
`SyncedCoachMaterial` in `debate-speech-writer`'s
`coach-materials-client.ts`. PR: #1002.

Investigated and intentionally deferred as separate, larger slices (not
done in this PR):
- `/settings` no longer surfaces account-level tool preferences or sync
  status — it was deliberately gutted down to CardMirror-editor-only
  settings (see that page's own doc comment), and `ToolSyncStatusPanel`
  only renders on `/tools` now. Re-adding a "Tools"/"Data & Sync" section
  to `/settings` is a reasonable follow-up, but it cuts against that
  documented intentional redesign, so it needs an explicit product
  decision (re-duplicate the sync status on both pages, or just link
  `/settings` → `/tools`?) rather than a unilateral revert.
- No per-item delete/manage affordance in "My Saved Items" itself
  (deletion, where it exists, lives inside each tool's own panel) — a
  real gap, but a UI-design-sized one (bulk delete? per-kind? confirm
  dialogs for ~21 different record shapes?) rather than a small slice.

Done (first slice): `/tools`' "My Saved Items" widget rendered nothing at
all for a signed-in user with no cloud-saved data yet — indistinguishable
from broken, and no demo of what the widget (or the tools it links) does.
It now shows a small "Try These Tools" preview of sample cards, each
badged "Sample" and linking to a real tool page, in that case. See
`getSampleCloudLibraryItems` in `packages/debate-round/src/state/cloudLibrary.ts`
and its use in `packages/debate-webview/src/routes/tools/MySavedItems.tsx`.
Only this one widget got sample data — every other tool page that shows an
empty state for a new user (the editor's file tree, Practice Drills history,
the Evidence Library, etc.) is the same gap and a good follow-up, one PR per
tool rather than a single sweeping change.

Done (second slice, Evidence Library): `/cards/library`'s Shared Evidence
Library showed a bare "No entries match this search." for a brand-new user
with zero submitted cards/blocks, indistinguishable from the same message a
real search-with-no-matches produces. It now shows a sample card and a
sample block, each badged "Sample", whenever the persisted repository is
genuinely empty (`hasEntries === false`) — a real "no matches" search on a
non-empty repository still gets the plain message. See
`getSampleEvidenceLibraryEntries` in
`packages/debate-search-evidence/src/lib/shared-evidence-library.ts` and its
use in `packages/debate-search-evidence/src/panels/EvidenceLibraryPanel.tsx`.
Practice Drills history and the REASON editor's file tree remain open
follow-ups, one PR each.

Done (third slice, Practice Drills history): `/drills`' Practice Drills
panel showed a bare "No practice drills yet." for a user with no persisted
drill sets, with no demo of what a generated drill set looks like. It now
shows a read-only sample drill set — one drill per kind (overview,
frontline, cross-ex, collapse), badged "Sample" — under that message
whenever `drillSets.length === 0` (past the loading state), never mixed
into a real, possibly-empty result. See `getSampleDrillSets` in
`packages/debate-practice-drills/src/state/drillSets.ts` and its use in
`packages/debate-practice-drills/src/panels/DrillSetsPanel.tsx`. The REASON
editor's file tree remains the last open follow-up from this ask.

Fixed (infra, unrelated to the sample-data slices above): `apps/debate-ai.com/drizzle/`
had been deleted from the tracked tree a third time (commit `d6d1bb8`,
"Delete apps/debate-ai.com/drizzle directory" — the same accident as
`2566e0d`/`d58d57f` and `39076f1`/`53656dd` before it, always an
unreviewed direct-to-mainline commit with no explanation), so every test
that boots an in-memory D1/libSQL db by replaying those migrations failed
with `ENOENT`. Restored all 68 migration files + `meta/` snapshots from the
last known-good restore (`53656dd`), then ran `bun run db:generate` to add
migration `0037_daffy_prowler.sql` for schema drift that had accumulated
since that restore without a matching migration (`detected_urls`,
`forum_threads`, `practice_profiles`, `practice_challenges` — the last two
are the Practice Partners feature's tables). `bun run db:generate` now
reports "No schema changes, nothing to migrate", confirming `schema.ts` and
`drizzle/` are back in sync. Also fixed, found while verifying this: a
missing `}` on `.pmd-reader-page-indicator` in
`packages/debate-editor/src/editor/style.css` (line 17016) broke postcss
and failed `bun run build` outright for both `debate-ai-web` and
`debate-web-ext` — unrelated to the migrations but a hard build blocker,
so fixed in the same PR rather than filed separately.

With both fixes: `bun run typecheck` (25/25 packages), `bun run test`
(10574 passed, 2 pre-existing unrelated failures, see below), and
`bun run build` all pass (submodules must be initialized —
`git submodule update --init` — for `debate-rankings-adapter` and
`debate-editor-cm-adapter`'s own suites/typecheck; CI already does this via
`checkout@v4`'s `submodules: true`).

Two pre-existing, unrelated test failures remain (confirmed present before
this PR's changes; not migration- or CSS-related) and are good small
follow-ups:
- `test/host/routes.test.ts` ("has an entry for every page the web app
  serves") — the Practice Partners feature (schema in `b099ae9`) added
  `app/practice-partners/page.tsx` but never registered `/practice-partners`
  in `packages/debate-webview`'s route table.
- `apps/debate-ai.com/lib/__tests__/docs-links-consistency.test.ts` — 26
  dead links in `packages/debate-help-docs/content/docs/**` to
  `internals/tool-data-sync.mdx` and a handful of other not-yet-written
  internals pages, plus two `/docs/packages` index links.



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

6. do order aiutoamativlly for roo and sync timer
