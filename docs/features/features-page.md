# Features Page

One page that outlines every user-facing surface in the app: each feature's
name, a one-line description, its route, and a link to its long-form doc,
grouped into eight categories and filtered by a single search box.

- **Route:** `/features`
- **Nav:** the global dock's Settings menu → **All Features** (the first item)
- **Package:** `apps/debate-ai.com/components/debate-ui`

## Why this exists

Nothing in the app listed everything it does:

- The global dock exposes four destinations (Videos, Shared, Debate, Docs)
  plus a Settings menu that is a flat, unexplained list of forty-odd items.
- [`/research`](../../apps/debate-ai.com/components/research/ResearchHub.tsx)
  and [`/coach`](../../apps/debate-ai.com/components/coach/CoachHub.tsx) each
  tab across the panels of one package.
- [`/community-hub`](./community-research-hub.md) covers only the spaces named
  under TODO.md's "Research Crowdsourcing Organizer Features" heading — 17 of
  them — and deliberately omits the core workspaces (card search, the flow
  spreadsheet, the video archive, the Reason editor) and the standings and
  rankings surfaces.

So a debater arriving at the app had no way to learn what it does short of
opening the Settings menu and clicking through every entry. This page is that
map.

## What it shows

| Element | Source |
| --- | --- |
| Header count line | `buildFeatureCatalogSummaryText` — e.g. "50 features across 8 categories: Core Workspaces (8), …" |
| Search box | `searchFeatures`, matching title, description, route, and hidden tags |
| Jump-to-category row | One pill per non-empty section, anchored to its `id` |
| Section heading + blurb | `FEATURE_CATEGORY_LABELS` / `FEATURE_CATEGORY_DESCRIPTIONS` |
| Feature card | Title (links to the route), description, the route itself, and a **Docs** link when the feature has one |

The count line always describes the whole catalog, not the current filter, so
it stays a stable "how big is this app" answer while someone types.

### Categories

| Category | What it groups |
| --- | --- |
| Core Workspaces | Video archive, card search, the flow spreadsheet, Reason docs/editor, the research/coach hubs, the community hub |
| Evidence & Research | Evidence and argument libraries, contributions feed, card scoring, peer review, revision incentives, coverage, progress, task inbox |
| Team Collaboration | Brainstorm boards, collaboration mode, prep room, prep notes, notifications, coaching programs, coach materials |
| Flowing & Round Analysis | Argument tree outline, transcript summaries, flow annotations, response-outcome charts, speech documents, word-count speeches |
| Pre-Round Intelligence | Opponent and judge profiles, briefings, scout-to-strategy, paradigm picker, AI judge decision |
| Practice & Coaching | Practice round simulator, versus-AI rounds, opponent personas, AI coach mode, drills |
| Recognition & Progress | Leaderboard, awards, daily best card, quests, streaks, unlocks, group challenges |
| Standings & Rankings | Team rankings |

## How it works

- [`apps/debate-ai.com/components/debate-ui/features/feature-catalog.ts`](../../apps/debate-ai.com/components/debate-ui/features/feature-catalog.ts)
  holds the pure data and helpers: `APP_FEATURES`, `buildFeatureSections`,
  `searchFeatures`, `featureDocUrl`, and `buildFeatureCatalogSummaryText`.
  Like `debate-card-search`'s narrower community-hub directory it has no
  store — every entry links to a surface that already persists (or doesn't
  need to persist) its own state.
- [`apps/debate-ai.com/components/debate-ui/features/FeaturesPanel.tsx`](../../apps/debate-ai.com/components/debate-ui/features/FeaturesPanel.tsx)
  renders it, holding only the search string in local state.
- [`apps/debate-ai.com/app/features/page.tsx`](../../apps/debate-ai.com/app/features/page.tsx)
  mounts the panel at `/features`.

Titles and descriptions are copied from each route's own `metadata` export
(or, where a route has none, from its feature doc's opening lines) so a card
reads the same as the page a reader lands on after clicking it.

Each entry may also carry `tags`: search terms that don't appear in the
visible copy — package names, synonyms, and the jargon a debater would
actually type. "elo" finds Team Rankings, "rfd" finds AI Judge Decision, and
"verbatim" finds both the Reason Editor and Speech Documents, none of which
mention those words on screen.

Both files live directly in the app (under `components/debate-ui/`, along
with the rest of what used to be the shared `debate-ui` package — see
[`TODO.md`](../../TODO.md) for that migration) rather than in a package,
even though the catalog names surfaces from `debate-round`,
`debate-card-search`, `debate-videos`, `debate-speech-writer`, and
`reason-editor`: nothing outside the app imports the catalog, so there's no
dependency-graph reason to keep it in a shared workspace package.

## Tests

There is no automated coverage for `feature-catalog.ts` or `FeaturesPanel.tsx`
today — `apps/debate-ai.com` has no Vitest setup of its own (the root Vitest
config's `packages/*` projects glob doesn't reach app code), and the tests
that used to cover them (`feature-catalog.test.ts`, `features-panel.test.tsx`)
lived in the now-removed `debate-ui` package's own `test/` directory. They
asserted: unique ids and routes, every entry categorized, every category
used, docs pointing at `.md` files, section grouping and ordering, search
across all four matched fields, doc-URL building, summary-line pluralization,
and (for the panel) every catalogued route, the category headings, the
summary line, a docs link, the jump nav, and that a one-entry catalog renders
without the jump nav — worth restoring if this app grows a test setup.

## Known gaps

- The catalog is a hand-maintained registry, so a new route has to be added
  to it as well. Nothing enforces that it covers every file under
  `apps/debate-ai.com/app/`.
- `/login` is intentionally absent: it's a step on the way to a feature
  rather than a feature, and it's already reachable from the Settings menu.
- The **Docs** links point at the feature docs on GitHub's `master` branch;
  the docs aren't served from the app itself.
