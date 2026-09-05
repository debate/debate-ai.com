# debate-ai-docs

The Debate AI documentation site: a Fumadocs-on-Next.js app based on the
[`template-fumadocs`](https://github.com/OpenSourceAGI/dev-tools-starter-agent/tree/master/starter-templates/template-fumadocs)
starter template, populated with this monorepo's own documentation.

## Running it

```bash
bun install   # from the repo root
bun run dev --filter=debate-ai-docs
# or
cd packages/debate-ai-docs && bun run dev
```

`bun run typecheck` regenerates the `.source/` collection and type-checks; `bun run build` produces a
production Next.js build.

## Routes

| Route | What it serves |
| --- | --- |
| `/` | Landing page: hero, the three task guides, and what the site covers |
| `/docs` | The docs, in a notebook layout with a collapsible sidebar and full-text search |
| `/docs/guides/*` | Task guides for the training, practice, and research collaboration tools |
| `/docs/features/*` | One page per product feature |
| `/docs/packages/*` | One page per workspace package |
| `/docs/api/docs-search` | Static Orama search index consumed by the search dialog |
| `/docs/llms-full.txt` | Every page as plain text, for LLM consumption |
| `/docs/<path>.mdx` | Any page's processed Markdown (rewritten to `/docs/llms.mdx/docs/<path>`) |

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

`apps/debate-ai.com/lib/docs-links.ts` builds every Docs/Guide link the app shows. Set
`NEXT_PUBLIC_DOCS_URL` to this site's deployed origin (for example `https://docs.debate-ai.com`) when
building the app and the links resolve here; without it they open the same `.mdx` source on GitHub.

## Known gaps

The template's favicon/touch-icon binary assets (`apple-touch-icon.png`, `favicon-192.png`,
`favicon-512.png`, `favicon.ico`) were not copied over — binary files can't go through the
text-based tools used to build this package. Add a source image to `public/favicon-512.png`
and run `bun run favicon`, or copy the icons over from the template manually.
