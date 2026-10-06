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

The Debate AI documentation: Fumadocs pages, based on the
[`template-fumadocs`](https://github.com/OpenSourceAGI/dev-tools-starter-agent/tree/master/starter-templates/template-fumadocs)
starter template and populated with this monorepo's own documentation. It is a
library, not a site of its own — the web app mounts it at `/docs`.

## Running it

```bash
bun install        # from the repo root
bun run dev:web    # the web app; open http://localhost:3000/docs
```

`bun run typecheck` (here) regenerates the `.source/` collection and type-checks.

## Where it's published

The docs are part of debate-ai.com rather than their own deployment, and are
served the same way as the rest of the app: `apps/debate-ai.com/app/docs/`
re-exports the route modules in `routes/`, and the app's `vite.config.ts`
compiles `content/` with `helpDocsMdx()` from `vite.mjs`. Every page below is
live at `https://debate-ai.com<route>`.

There is no `basePath`, so every URL spells out the `/docs` prefix — the page
tree, nav links and links inside the MDX alike. Code builds it from
`DOCS_BASE_PATH` / `withBasePath` in `lib/fumadocs/base-path.ts`.

The app renders `/docs` without its own dock and sidebar, and `styles/docs.css`
(a separate Tailwind build, loaded only on `/docs`) styles it with the colour
theme the reader picked in the app.

## Routes

| Route | What it serves |
| --- | --- |
| `/docs` | The docs, in a notebook layout with a collapsible sidebar and full-text search |
| `/docs/features/*` | One page per product feature, including the task guides for the training, practice, and research collaboration tools |
| `/docs/packages/*` | One page per workspace package |
| `/docs/welcome` | Landing page: hero, the three task guides, and what the site covers |
| `/docs/api/docs-search` | Orama search index, downloaded once and queried in the browser by the search dialog |
| `/docs/llms-full.txt` | Every page as plain text, for LLM consumption |
| `/docs/llms.mdx/<path>.mdx` | Any page's processed Markdown, behind each page's Copy / Ask AI buttons |

Each docs page has a "last updated" line sourced from the GitHub commits API when the Worker has a
`GITHUB_TOKEN`, looked up once per page per Worker isolate; without one the lookup is skipped rather than
exhausting the unauthenticated rate limit.

## Content

All documentation content lives under `content/docs/`:

- `content/docs/features/{training-tools,practice-tools,research-collaboration}.mdx` — task-oriented walkthroughs. The app's tool pages link to these: every page under
  `apps/debate-ai.com/app` that uses `ToolPageHeader` names the guide it belongs to, and each workspace hub
  section (`components/research/ResearchHub.tsx`, `components/coach/CoachHub.tsx`) links to its guide.
- `content/docs/features/` mirrors `docs/features/*.md` — one page per product feature.
- `content/docs/packages/` mirrors `packages/*/README.md` — one page per workspace package.

To add a new page, add the `.md`/`.mdx` file directly under one of those folders (with a `title` frontmatter
field), or re-sync it from its source file in the monorepo. Section order is set by each folder's
`meta.json`.

## Linking from the app

`apps/debate-ai.com/lib/docs-links.ts` builds every Docs/Guide link the app shows, and
`lib/ui/features/feature-catalog.ts` builds the per-feature links on `/practice/features`. Both point at
`/docs/...` on the app's own origin, which needs no configuration since the docs are app routes. `NEXT_PUBLIC_DOCS_URL` overrides just the origin, for a separate deployment of this site (for
example `https://docs.debate-ai.com`), which serves the docs under `/docs` as well.

## Known gaps

The docs nav shows an icon rather than a logo image: the template's favicon assets were never
copied over. Pages under `/docs` use the app's own favicon.
