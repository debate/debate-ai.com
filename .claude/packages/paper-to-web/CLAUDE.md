# CLAUDE.md — `paper-to-web`

Public (`@debate-ai/paper-to-web`), "Paper to Web AI". Any PDF, paper, arXiv /
archive.org link, DOI or pasted text → the Synergy Slayer paper format, plus
AI outlines in that format. Entry `src/index.ts`, React widget
`src/widget/`, web app handler `src/server.ts`, CLI `bin/paper-to-web.ts`,
tests in `test/`.

## Standalone on purpose

The user asked for this to be a separate tool, not part of the site. Don't
mount it in `apps/debate-web`, don't add it to the sidebar or help-docs nav,
and don't import other `@debate-ai/*` packages into it. It has no help-docs
feature page for the same reason.

## The format is the critiques paper's

`src/mdx.ts` mirrors `packages/debate-help-docs/content/docs/learn/critiques/
synergy-slayer-critiques/`: `"N. Title"` frontmatter, figure + `*Figure N: …*`
caption, the Fumadocs `Accordions` "Section Summary" with `**label:** text`
points, numbered paragraphs on one line each, `==text==` underlining, and a
`meta.json` with `---Part---` separators. If that folder's layout changes,
change this to match. `test/mdx.test.ts` compiles every output with
`@mdx-js/mdx` + `remark-gfm` — keep it that way; MDX parses `{ } < >` as code.

## Text rules

- `Paper.title`, section titles and parts are **plain text**; every other
  string (paragraphs, summaries, descriptions, abstract, references) is
  **MDX-escaped markdown** (`escapeMdxText`). Frontmatter writes plain text.
- Underlining is never allowed to change the prose: the AI returns verbatim
  phrases and `applyUnderlines` wraps only exact matches.
- `### ` paragraphs are subheadings inside a section; numbering skips them.

## Reader runtime

`src/reader-runtime.ts` holds the Reader mode / Underlining / Voice script as a
source string, inlined verbatim into the HTML export and evaluated for the
React widget. Keep it plain ES2017 with no outer references. Its voice-block
rules copy help-docs' `components/guides/voice-read-text.ts`.

## Extraction

`extract-webpage` and `extract-pdf` load lazily (`src/source.ts`) and log a
lot; `quietly()` silences them. arXiv links go to the arXiv HTML render first
(keeps headings), then the PDF. PDFs have no heading tags, so
`promotePseudoHeadings` turns "1. Introduction" lines into headings.

## Commands

```bash
bun bin/paper-to-web.ts https://arxiv.org/abs/1706.03762 --out /tmp/out --format all
bun bin/paper-to-web.ts serve --port 8787          # widget web app
bunx vitest run                                     # in this folder
```
