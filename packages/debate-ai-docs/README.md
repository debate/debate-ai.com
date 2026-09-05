# debate-ai-docs

The Debate AI documentation site: a Fumadocs-on-Next.js app reused verbatim from the
[`template-fumadocs`](https://github.com/OpenSourceAGI/dev-tools-starter-agent/tree/master/starter-templates/template-fumadocs)
starter template, populated with this monorepo's own documentation.

## Running it

```bash
bun install   # from the repo root
bun run dev --filter=debate-ai-docs
# or
cd packages/debate-ai-docs && bun run dev
```

## Content

All documentation content lives under `content/docs/`:

- `content/docs/features/` mirrors `docs/features/*.md` — one page per product feature.
- `content/docs/packages/` mirrors `packages/*/README.md` — one page per workspace package.

To add a new page, add the `.md`/`.mdx` file directly under one of those folders (with a
`title` frontmatter field), or re-sync it from its source file in the monorepo.

## Known gaps

The template's favicon/touch-icon binary assets (`apple-touch-icon.png`, `favicon-192.png`,
`favicon-512.png`, `favicon.ico`) were not copied over — binary files can't go through the
text-based tools used to build this package. Add a source image to `public/favicon-512.png`
and run `bun run favicon`, or copy the icons over from the template manually.
