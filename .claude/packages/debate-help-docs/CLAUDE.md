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
