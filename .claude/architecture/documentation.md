# Documentation

## Where it lives

| If it is… | It goes in… |
| --- | --- |
| A guide a debater or contributor would read | `packages/debate-help-docs` |
| A feature, for someone using it | `packages/debate-help-docs/content/docs/features/` |
| A feature, for someone changing its code | `packages/debate-help-docs/content/docs/internals/` |
| What a package is and what it depends on | `packages/README.md` — the index everyone reads first |
| How to use one package | That package's own `README.md` |
| How an agent should work in a package | That package's `CLAUDE.md` |
| Repo-wide agent orientation | root `CLAUDE.md` + `.claude/architecture/` |

## `/docs` is part of the app, not deployed separately

`packages/debate-help-docs` is a Fumadocs library that the web app **mounts**,
like every other feature package: `apps/debate-ai.com/app/docs/` holds one-line
route files that re-export the package's `routes/` modules, so the docs are
ordinary app routes rendered by the app's Worker. There is no separate docs
build, no static export and no `public/docs` copy.

- **The app's Vite build compiles the MDX.** `vite.config.ts` registers
  `helpDocsMdx()` from `debate-help-docs/vite` — fumadocs-mdx's Vite plugin,
  pointed at the package's `source.config.ts` and writing its generated
  collections to the package's `.source/`. `bun run dev:web` serves the docs at
  `/docs` with hot reload; there is no standalone docs dev server.
- **URLs carry `/docs` themselves.** There is no `basePath`: the page tree,
  nav links, homepage links and root-relative links inside the MDX all spell
  out `/docs/…` (`DOCS_BASE_PATH` in `lib/fumadocs/base-path.ts`). A content
  link written as `/features/x` now points at the app's routes, not the docs.
- **`/docs` renders without the app shell.** `AppShell` returns its children
  bare there (`isDocsPath`), and the docs load their own Tailwind build
  (`styles/docs.css`, imported by the docs root layout, so only on `/docs`).
  Moving between `/docs` and the rest of the app is always a full page load —
  `/docs` stays in `NON_ROUTER_PREFIXES` — so that stylesheet never lingers on
  an app page.
- **It is not behind the Turnstile gate** — `/docs` is on the exempt list in
  `lib/turnstile/request-filter.ts`, as it was when it was static assets.
- It publishes both docs tiers **and the package READMEs**. So a package README
  is user-facing documentation here — write it that way, and keep
  `packages/README.md` current when a package's purpose or dependencies change.

`debate-help-docs` is excluded from the Vitest projects (it is a site, not a
tested library), so nothing in the test run will tell you the docs build broke.

## Every feature has two docs

There is no root `docs/` folder — it was folded into the help-docs package, so
the repo has one docs home. Each feature gets two pages there, for two readers:

| Section | Reader | Shape |
| --- | --- | --- |
| `content/docs/features/<name>.mdx` | Someone using the app | ~35 lines: what it does and what it is for |
| `content/docs/internals/<name>.mdx` | Someone changing the code | ~300 lines: route/package/component, exact behaviour, the data-flow chain, Known gaps |

**Change behaviour, update both.** The internals page is what source comments
point at — its "Known gaps" list is cited from ~150 places in the code, and
closing a gap means editing that list, not just the code.

### Two MDX traps, both of which have broken the build

These pages were folded in from plain `.md`, where neither is an error:

- **A backslash does not escape a backtick inside a code span.** Writing
  ``` `a \`b\` c` ``` ends the span at the first inner backtick; whatever
  follows lands in prose, and MDX compiles `{...}` there as JSX. That threw
  `ReferenceError: kind is not defined` during `next build` and took down every
  Cloudflare Workers build of the app. Use a double-backtick span instead:
  ``` ``a `b` c`` ```.
- **A bare `{` or `<` outside a code fence is JSX.** Wrap identifiers and
  placeholders in backticks — `` `<aside>` ``, `` `{url}` ``.

Since `debate-help-docs` is excluded from the Vitest projects, neither shows up
in the test run. A web app build (`bun run build` in `apps/debate-ai.com`)
compiles every page and is the check that catches them.

## The API spec

`packages/debate-api-client/debate-openapi.yml` is the source of truth for the
API, and `packages/debate-api-client` is **generated from it** with Hey API. To
change the client, change the route and the spec, then regenerate — never
hand-edit the generated SDK.

The spec is also what's served at
[debate-ai.com/api](https://debate-ai.com/api).
