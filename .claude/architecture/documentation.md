# Documentation — Where It Goes

All prose documentation lives in the user guide package,
**`packages/debate-help-docs/content/docs`**. There is deliberately **no root
`docs/` folder**; one existed, its contents were folded into the user guide, and
recreating it splits the documentation in two again — only the help-docs site is
actually published.

## The two tiers

Each feature gets two pages, in two sections, written for two readers:

| Section | Reader | Shape |
| --- | --- | --- |
| `content/docs/features/<name>.mdx` | Someone using the app | ~35 lines: what it does, where it is, what it is for |
| `content/docs/internals/<name>.mdx` | Someone changing the code | ~300 lines: route/package/component, exact behaviour, the data-flow chain, Known gaps |

Plus `content/docs/guides/` (task-oriented walkthroughs) and
`content/docs/packages/` (one page per workspace package).

**Change behaviour, update both.** The internals page is what source comments
point at — `packages/debate-help-docs/content/docs/internals/<name>.mdx`'s "Known
gaps" is cited from ~150 places in the code, and closing a gap means editing that
list, not just the code.

### The internals page shape

```markdown
---
title: "..."
---

# ...

- **Route:** /summaries
- **Package:** debate-round

## What it shows
## Data flow          ← the call chain, state file → selector → panel → route
## Known gaps         ← what is deliberately not done yet
```

Keep it. Both the "Known gaps" convention and the data-flow block are load-bearing
— they are how a later change finds what it is meant to close.

## Adding a page

1. Write the `.mdx` with frontmatter — `title` is required by `frontmatterSchema`
   in `source.config.ts`. This repo keeps an `# H1` as well as the frontmatter
   title; match that.
2. Add the slug to `meta.json` in that directory (the root `meta.json` uses
   `...<section>` spreads, so a new *page* in an existing section only needs the
   section's own meta; a new *section* needs a `---Label---` separator and a
   `...<section>` entry at the root).
3. MDX rules apply: a bare `{` or `<` outside a code fence is parsed as JSX. Wrap
   identifiers and placeholders in backticks — `` `<aside>` ``, `` `{url}` ``.
   Backticks are the only escape that works: a backslash does **not** escape a
   backtick inside a code span, so `` `a \` b` `` ends the span at the
   backslashed backtick and spills the rest into JSX. Quote a snippet that
   itself contains backticks with a longer fence — ``` `` `${x}` `` ``` — and
   prefer a fenced block for anything multi-line.
4. Links must work **on the published site**, so filesystem-relative links into
   the repo (`../../packages/...`) do not resolve. Link to GitHub
   (`https://github.com/debate/debate-ai.com/blob/master/...`) or to another docs
   page.

## How docs reach `/docs`

`packages/debate-help-docs` is its own Next app, statically exported
(`output: 'export'`, `basePath: '/docs'`) — every page is prerendered, so the site
is a folder of files with no server behind it.

```
packages/debate-help-docs   →  next build (export)  →  out/
  → apps/debate-ai.com/scripts/build-docs.mjs
  → apps/debate-ai.com/public/docs/        (gitignored build output)
  → wrangler assets.directory → served at /docs
```

The Worker's static-asset binding answers `/docs/...` before the request reaches
the app's router. `SKIP_DOCS_BUILD=1` reuses an existing `out/`.

## Linking from the app into the docs

`apps/debate-ai.com/lib/docs-links.ts` builds every in-app docs link. Tool page
headers and both workspace hubs use it, and the link targets come from
`APP_FEATURES` in the feature catalog (`lib/ui/features/feature-catalog.ts`, and
its copies in `debate-ui` and `debate-contributor-progress`). A feature's `doc`
field is the file name under `content/docs/features/`.

Links are same-origin by default because the docs ship inside the app;
`NEXT_PUBLIC_DOCS_URL` overrides only the origin for a separately-deployed site.

## Docs that stay next to their code

Two exceptions, deliberately not in the user guide:

- `apps/debate-native-wrapper/docs/` — build, platform, app-store and OAuth notes
  for the Tauri wrapper. Heavily cross-linked and referenced from the release
  workflow; they travel with that app.
- `packages/debate-round-practice-ai/` — a vendored sub-app with its own
  `REPOSITORY_GUIDE.md` and `cf-app/docs/`.

Everything else belongs in `packages/debate-help-docs/content/docs`.
