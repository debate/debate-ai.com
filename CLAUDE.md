# CLAUDE.md — debate-ai.com

Orientation for Claude agents working in this repository. Read this first; the
detailed notes live in [`.claude/architecture/`](.claude/architecture/).

A **Bun + Turborepo monorepo** behind debate-ai.com: a competitive-debate
workspace — evidence cards, flow sheets, round archives, practice drills, an AI
judge, and the CardMirror document editor — shipped as a Next.js app on
Cloudflare Workers, a Tauri native wrapper and a browser extension.

## Ground rules

1. **Bun, never npm or yarn.** `packageManager` pins `bun@1.3.11`; CI installs
   with exactly that. Commit `bun.lock` when it changes.
2. **Find the owning package before you edit.** `apps/debate-ai.com` mostly wires
   things together; the feature usually lives in a `packages/debate-*` library.
   See [`architecture/overview.md`](.claude/architecture/overview.md).
3. **Documentation goes in the user guide package**,
   `packages/debate-help-docs/content/docs`. There is deliberately **no root
   `docs/` folder** — do not recreate one. See
   [`architecture/documentation.md`](.claude/architecture/documentation.md).
4. **Every feature has two docs**: a user-facing page under `content/docs/features/`
   and an engineering note under `content/docs/internals/`. Behaviour changes
   update both.
5. **`typecheck` is a CI gate.** `bun run typecheck` runs across every package on
   every PR and is as blocking as the tests.
6. **Respect package boundaries.** Import from a package's public entry point,
   never from its internals.
7. **Never commit secrets**, credentials, API keys, build output, or an unrelated
   `bun.lock` diff.

## Where things live

| You want to change… | Go to |
| --- | --- |
| The document / card editor | `packages/debate-editor` (CardMirror, ProseMirror) |
| The flow sheet | `packages/debate-flow` |
| Rounds, summaries, judge decisions | `packages/debate-round` |
| Drills, practice rounds, coaching sessions | `packages/debate-practice-drills` |
| Evidence search and the card library | `packages/debate-search-evidence` |
| Speech docs, coach materials, judge profiles | `packages/debate-speech-writer` |
| Video library and transcripts | `packages/debate-videos` |
| Shared UI primitives, the feature catalog | `packages/debate-ui` |
| Routes, `/api`, auth, D1 schema, migrations | `apps/debate-ai.com` |
| Documentation | `packages/debate-help-docs/content/docs` |

Full map: [`architecture/overview.md`](.claude/architecture/overview.md) ·
[`packages/README.md`](packages/README.md).

## Commands

```bash
bun install                    # never npm/yarn
bun run dev                    # turbo dev — the whole pipeline
bun run dev:web                # just the web app
bun run dev:editor             # just the editor
bun run typecheck              # turbo typecheck — a CI gate
bun run test                   # vitest (root config points at the app's)
bun run coverage               # vitest + coverage, as CI runs it
bun run build                  # turbo build
```

## Before you open a PR

- `bun run typecheck`, then `bun run test`.
- Update both the `features/` page and the `internals/` note for the behaviour
  you changed, and the package `README.md` if its public API moved.
- Commit style is **gitmoji + conventional commits**:
  `✨ feat(scope): what changed`. See
  [`architecture/conventions.md`](.claude/architecture/conventions.md).
- Target `master`. Keep the PR focused; no drive-by refactors.

## Detailed notes

| Note | Covers |
| --- | --- |
| [overview.md](.claude/architecture/overview.md) | The product, every app and package, how they fit together |
| [web-app.md](.claude/architecture/web-app.md) | The Cloudflare app: Worker, D1, cron, auth, deploy, offline SW |
| [documentation.md](.claude/architecture/documentation.md) | The two-tier docs model, the Fumadocs build, how docs reach `/docs` |
| [conventions.md](.claude/architecture/conventions.md) | Code style, commits, PRs, CI, publishing, security |
