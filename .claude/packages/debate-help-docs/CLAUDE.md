# CLAUDE.md — `debate-help-docs`

Public (`@debate-ai/` scope). The Debate AI documentation, on Fumadocs — a library the web app
mounts at `/docs`, not a site of its own.

## The web app renders it

- `routes/` holds the route modules (layouts, the page, the search and
  `llms` handlers); `apps/debate-ai.com/app/docs/` re-exports them one file per
  route. Add a docs route by adding a module here and a one-line file there.
- The app's Vite build compiles `content/` through `helpDocsMdx()`
  (`vite.mjs`), which writes the generated collections to this package's
  `.source/`. `bun run typecheck` here regenerates `.source/` on its own.
  Develop with the app's `bun run dev:web` and open `/docs`.
- **There is no `basePath`.** Every URL spells out `/docs` — the page tree
  (`baseUrl` in `lib/fumadocs/source.tsx`), nav and homepage links, `fetch`
  URLs, and root-relative links inside the MDX. Build them from
  `DOCS_BASE_PATH` / `withBasePath` in `lib/fumadocs/base-path.ts`.
- **No `@/` imports.** The app's `@/` alias points at the app, so this
  package's files import each other by relative path.
- `/docs` renders without the app shell, and `styles/docs.css` is its own
  Tailwind build (`source(none)` plus explicit `@source`s), loaded only by the
  docs root layout. Colours come from the app's theme through
  `fumadocs-ui/css/shadcn.css`.

## Two sites: `/docs` and `/docs/dev`

`content/docs/` is the user docs (`source`, `lib/fumadocs/source.tsx`). `dev-docs/` is the
developer docs: a separate Fumadocs collection and loader (`devSource`,
`lib/fumadocs/dev-source.tsx`) with its own routes (`routes/dev-*`), mounted at
`app/docs/dev`. It is unlisted — never link to it from the user docs or the app, and never feed
`devSource` into the sitemap, search, llms.txt or the docs tree. See
`.claude/packages/dev-docs/CLAUDE.md`.

## It has no tests, and nothing will tell you it broke

This package is explicitly excluded from the Vitest projects in
`apps/debate-web/vitest.config.ts`. The test run is green whether or not
the docs compile. Build the web app before you claim it works.

## What it publishes

The product's feature specs (`content/docs/features/`) **and the package READMEs**.
That makes a package README user-facing documentation in this repo — write them
for debaters and contributors, not just for maintainers, and keep
`packages/README.md` current.

## MDX extensions

Registered in `source.config.ts`; each is a plain unified plugin in `lib/mdx/`.

- `remark-debate-highlight.ts` — `==text==` → policy-style highlights, on the
  Synergy Slayer of Critiques pages only.
- `remark-drop-title-heading.ts` — drops a page's leading `#` heading when it
  repeats the frontmatter title (or the title plus a subtitle). Every page
  now opens with `DocsPageHeader` (`components/fumadocs/layout/docs-page-header.tsx`):
  breadcrumbs from the page tree (`lib/fumadocs/page-breadcrumbs.ts`), each
  crumb opening a CSS-only hover dropdown of its siblings, then the title as
  a modest `text-2xl` heading. Content files keep their `#` headings; pages
  without one (the Synergy Slayer critiques, tournament admin) get a title
  from frontmatter.
- Synergy Slayer pages also get two buttons after Copy / Ask AI: the
  Underlining toggle (`components/guides/highlight-toggle.tsx`) and **Voice**
  (`voice-read-button.tsx`), which reads the page aloud paragraph by
  paragraph at 0.7 × 0.86 (≈0.6x) the Settings speed (×1.7 with **Fast speech**, on by
  default). Cloudflare Workers AI Aura via `/api/tts` `route: "cloudflare"`
  (signed-in only) reads by default. A chevron menu beside the button holds
  two toggles kept in localStorage `debate-docs-voice-options`: **Local
  Kokoro** (off by default) makes in-browser Kokoro race Cloudflare per
  paragraph (`voice-read-queue.ts`: Kokoro fed the whole page in order, up to
  6 paragraphs ahead; Cloudflare the paragraph playing plus 3; first audio
  wins), downloading the model first with a percentage and fill bar while
  Cloudflare reads. The model lives in Cache Storage (`transformers-cache`),
  with `navigator.storage.persist()` requested.
  Text neither engine voiced is spoken by the browser. Collapsed `<details>`
  are read too; figures and `*Figure N:*` captions are skipped; with
  Underlining on it reads only `<mark>` text, off all the text
  (`voice-read-text.ts`, tested from
  `apps/debate-web/lib/__tests__/docs-voice-read-text.test.ts` and
  `docs-voice-read-queue.test.ts`).
- `rehype-citation-cards.ts` — on the Synergy Slayer pages, every author-date
  citation (`Shanahan (1993)`, `(Alinsky 1971, 66)`) that matches an entry of
  that folder's `references.mdx` becomes a `<CitationCard>`
  (`components/guides/citation-card.tsx`): a link to `references#ref-…` with a
  tooltip showing the entry's number, bibliography line, qualifications and
  card. Unmatched citations stay plain text. The matching is in
  `citation-cards.ts` and tested from
  `apps/debate-web/lib/__tests__/docs-citation-cards.test.ts`. It is a rehype
  plugin on purpose: it runs after Fumadocs takes the processed Markdown, so
  Copy Markdown and llms.txt keep plain citations. To give another folder the
  same treatment, add a `CitationCollection` for it.
  The matcher also takes `n.d.` years, a citation buried in a prose
  parenthetical (`(In a classic critique, Galloway, 2020, showed …)`), and an
  entry's first italic work after the year as an author label, so a film or a
  web outlet can be cited by name (`The Great Debaters (2007)`,
  `(BBC Future, 2020)`).
  The `references.mdx` entries are written in Chicago notes-bibliography
  order, year near the end (`Last, First. “Title.” <em>Site</em>, July 29,
  2003.`, `<em>Journal</em> 26, no. 3 (1999): 183–201`, `Publisher, 1994.
  Originally published 1888.`). `toAuthorDate` in `lib/citation-styles.ts`
  moves the year back behind the byline before the hover-card matcher and the
  APA/MLA/Harvard switcher parse an entry, so write new entries that way too.
  Three papers are registered: the Synergy Slayer of Critiques
  (`learn/critiques/synergy-slayer-critiques/`), the Synergy Slayer of
  Non-Intrinsic Concerns (`learn/counterplans/synergy-slayer-intrinsicness/`)
  and Debate AI Collective Consciousness
  (`learn/resources/debate-ai-collective-consciousness/`). All three share the
  highlight styling, the toggle buttons and `SYNERGY_SLAYER_DIRS`. Same-year
  works by one author use `2026a.` / `2026b.`, and a two-word co-author
  surname can be cited in full (`De Liddo & Buckingham Shum, 2013`).
