<!-- template-git-repo:badges:start -->
<p align="center">
    <a href="https://debate-ai.com/docs"><img src="https://img.shields.io/badge/Docs-blue?logo=ReadTheDocs&logoColor=white" alt="Documentation" /></a>
    <br />
    <a href="https://github.com/debate/debate-ai.com/stargazers"><img src="https://img.shields.io/github/stars/debate/debate-ai.com" alt="GitHub Stars" /></a>
    <br />
    <a href="https://github.com/debate/debate-ai.com/issues"><img src="https://img.shields.io/github/issues/debate/debate-ai.com?logo=github" alt="GitHub Issues" /></a>
    <a href="https://github.com/debate/debate-ai.com/pulls"><img src="https://img.shields.io/github/issues-pr/debate/debate-ai.com?logo=github&label=PRs" alt="Open Pull Requests" /></a>
    <a href="https://github.com/debate/debate-ai.com/pulls?q=is%3Apr+is%3Aclosed"><img src="https://img.shields.io/github/issues-pr-closed/debate/debate-ai.com?logo=github&label=PRs%20merged&color=8957e5" alt="Merged Pull Requests" /></a>
    <a href="https://github.com/debate/debate-ai.com/discussions"><img src="https://img.shields.io/github/discussions/debate/debate-ai.com" alt="GitHub Discussions" /></a>
    <a href="https://github.com/debate/debate-ai.com/commits/master/"><img src="https://img.shields.io/github/last-commit/debate/debate-ai.com.svg" alt="GitHub last commit" /></a>
    <br />
    <a href="https://stackblitz.com/github/debate/debate-ai.com/tree/master/packages/debate-help-docs"><img height="20px" src="https://developer.stackblitz.com/img/open_in_stackblitz.svg" alt="Open in StackBlitz" /></a>
    <img src="https://img.shields.io/badge/Bun-14151A?logo=bun&logoColor=white" alt="Bun" /> <img src="https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white" alt="TypeScript" /> <img src="https://img.shields.io/badge/Next.js-black?logo=nextdotjs&logoColor=white" alt="Next.js" /> <img src="https://img.shields.io/badge/React-20232A?logo=react&logoColor=white" alt="React" /> <img src="https://img.shields.io/badge/Cloudflare%20Workers-F38020?logo=cloudflareworkers&logoColor=white" alt="Cloudflare Workers" /> <img src="https://img.shields.io/badge/Tailwind%20CSS-06B6D4?logo=tailwindcss&logoColor=white" alt="Tailwind CSS" /> <img src="https://img.shields.io/badge/shadcn%2Fui-000000?logo=shadcnui&logoColor=white" alt="shadcn/ui" /> <img src="https://img.shields.io/badge/Fumadocs-000000" alt="Fumadocs" />
</p>
<!-- template-git-repo:badges:end -->

# debate-help-docs

The Debate AI documentation site: a Fumadocs-on-Next.js app based on the
[`template-fumadocs`](https://github.com/OpenSourceAGI/dev-tools-starter-agent/tree/master/starter-templates/template-fumadocs)
starter template, populated with this monorepo's own documentation.

## Running it

```bash
bun install   # from the repo root
bun run dev --filter=debate-help-docs
# or
cd packages/debate-help-docs && bun run dev
```

`bun run typecheck` regenerates the `.source/` collection and type-checks; `bun run build` writes the
static export to `out/`. `bun run dev` serves the site at `http://localhost:3000/docs` — the same
`/docs` prefix it has in production, so links and asset URLs behave the same as they will once
published. (There is no `next start` here: an export has no server behind it.)

To rebuild the copy the web app serves, run `bun run build:docs` from `apps/debate-ai.com` (or just
build that app — it runs the same step).

## Where it's published

The docs are part of debate-ai.com rather than their own deployment. This app
static-exports (`output: 'export'`) under `basePath: '/docs'`, and
`apps/debate-ai.com/scripts/build-docs.mjs` — wired into that app's `build`
script — runs this package's build and copies the export into
`apps/debate-ai.com/public/docs`. The Worker's static-asset binding serves it,
so every page below is live at `https://debate-ai.com<route>`.

Because `basePath` supplies the `/docs` prefix, routes in `app/` are written
*without* it: `app/(docs)/[[...slug]]` is `/docs`, not `/docs/docs`. The prefix
is only spelled out for URLs that bypass the router (`fetch`, `window.location`),
which build it from `DOCS_BASE_PATH` in `lib/fumadocs/base-path.ts`.

## Routes

| Route | What it serves |
| --- | --- |
| `/docs` | The docs, in a notebook layout with a collapsible sidebar and full-text search |
| `/docs/guides/*` | Task guides for the training, practice, and research collaboration tools |
| `/docs/features/*` | One page per product feature |
| `/docs/packages/*` | One page per workspace package |
| `/docs/welcome` | Landing page: hero, the three task guides, and what the site covers |
| `/docs/api/docs-search` | Static Orama search index consumed by the search dialog |
| `/docs/llms-full.txt` | Every page as plain text, for LLM consumption |
| `/docs/llms.mdx/<path>.mdx` | Any page's processed Markdown, behind each page's Copy / Ask AI buttons |

Each docs page has a "last updated" line sourced from the GitHub commits API when a `GITHUB_TOKEN` is set at
build time; without one the lookup is skipped rather than exhausting the unauthenticated rate limit.

## Content

All documentation content lives under `content/docs/`:

- `content/docs/guides/` — task-oriented walkthroughs. The app's tool pages link to these: every page under
  `apps/debate-ai.com/app` that uses `ToolPageHeader` names the guide it belongs to, and each workspace hub
  section (`components/research/ResearchHub.tsx`, `components/coach/CoachHub.tsx`) links to its guide.
- `content/docs/features/` mirrors `docs/features/*.md` — one page per product feature.
- `content/docs/packages/` mirrors `packages/*/README.md` — one page per workspace package.

To add a new page, add the `.md`/`.mdx` file directly under one of those folders (with a `title` frontmatter
field), or re-sync it from its source file in the monorepo. Section order is set by each folder's
`meta.json`.

## Linking from the app

`apps/debate-ai.com/lib/docs-links.ts` builds every Docs/Guide link the app shows, and
`lib/ui/features/feature-catalog.ts` builds the per-feature links on `/features`. Both point at
`/docs/...` on the app's own origin, which needs no configuration now that the export ships with the
app. `NEXT_PUBLIC_DOCS_URL` overrides just the origin, for a separate deployment of this site (for
example `https://docs.debate-ai.com`), which serves the docs under `/docs` as well.

## Known gaps

The template's favicon/touch-icon binary assets (`apple-touch-icon.png`, `favicon-192.png`,
`favicon-512.png`, `favicon.ico`) were not copied over — binary files can't go through the
text-based tools used to build this package. Add a source image to `public/favicon-512.png`
and run `bun run favicon`, or copy the icons over from the template manually.
