# debate-reading-mode — `@debate-ai/reading-mode`

The parts of the browser extension's reading mode that don't depend on where
they run, shared by `apps/debate-browser-ext` (the article panel) and
`packages/debate-help-docs` (Synergy Slayer "Suggest questions" and Reading
mode). Plain TypeScript and DOM; no React, no styling, no dependencies.

- `src/highlights.ts` — `<mark class="reader-highlight">` passages: wrap a
  selection, remove one, list them. Each host styles the class itself.
- `src/questions.ts` — the Ask / Suggest questions prompts (kept word for
  word from the extension's original handlers) and reply parsing. Hosts pass
  a `Generate` function: the extension calls a saved provider key or the
  account, the docs call the hosting site's own endpoint (relative `/api/reason-ai`
  by default, overridable with `configureDocsAi` from
  `@debate-ai/help-docs/docs-ai` or `<meta name="docs-ai-endpoint">`), sending
  `allowGuest` so signed-out readers get free-model answers.
- `src/sections.ts` — load several rendered pages and keep one content
  element of each (scripts and ids stripped), for reading a whole section.

Keep it host-agnostic: no `wxt`/`browser` APIs, no Next.js, no Tailwind
classes. Tests in `test/` run under jsdom
(`bunx vitest run --project @debate-ai/reading-mode` from apps/debate-web).
