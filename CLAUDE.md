# CLAUDE.md — Debate AI

Orientation for Claude agents working in this repository. Read this first; the
detailed notes live in [`.claude/architecture/`](.claude/architecture/) and are
linked from each section below.

A **Bun + Turborepo monorepo**. One product for competitive debaters (PF, LD,
Policy) — evidence research, card editing, live round flowing, practice against
an AI opponent, timers and a video library — shipped as a Next.js app on
Cloudflare Workers at [debate-ai.com](https://debate-ai.com), plus a browser
extension and a native wrapper.

## Ground rules

1. **Bun, never npm or yarn.** `packageManager` pins `bun@1.3.11`. Commit
   `bun.lock` when it changes. (Several package scripts still say `npm run …`
   internally — that is stale; use `bun`.)
2. **Find the owning package before you edit.** Nearly every feature lives in a
   `packages/debate-*` library and is merely *mounted* by a route in the app.
   See [`architecture/overview.md`](.claude/architecture/overview.md).
3. **The directory name is often not the package name.** `debate-flow` publishes
   as `debate-flow-ebb`, `debate-search-evidence` as `debate-research-evidence`,
   `debate-practice-drills` as `debate-practice-rounds`,
   `debate-round-practice-ai` as `debate-practice-vs-ai`, and
   `debate-contributor-progress` as `debate-community`. Turbo filters take the
   **package name**.
4. **Only `apps/debate-ai.com` is a workspace.** `apps/debate-native-wrapper`
   and `apps/debate-web-ext` are deliberately outside the workspace globs — a
   root `bun install` does not install them. See
   [`architecture/monorepo.md`](.claude/architecture/monorepo.md).
5. **Tests live in each package's `test/` folder**, and there is exactly one
   Vitest config for the whole repo, at `apps/debate-ai.com/vitest.config.ts`.
   The root is kept free of tool configs on purpose — don't add one.
6. **Respect package boundaries.** Import from a package's public entry point,
   never reach into its internals. The dependency edges between the
   `debate-*` packages are real and documented — read them before adding one.
7. **Never commit secrets**, credentials, API keys, or build output.

## Where things live

| You want to change… | Go to |
| --- | --- |
| Evidence search, card scoring, review queue | `packages/debate-search-evidence` |
| The card editor (CardMirror / ProseMirror, `.docx` interop) | `packages/debate-editor` |
| Parsing Verbatim `.docx` / HTML into cards | `packages/debate-card-parser` |
| The live round workspace (FIAT), flow grid, round setup | `packages/debate-round` |
| The `ebb` flow editor embedded in a round | `packages/debate-flow` |
| Practice drills, AI coach, AI judge | `packages/debate-practice-drills` |
| A full timed round vs. an AI opponent | `packages/debate-round-practice-ai` |
| Speech/prep timers and the in-round recorder | `packages/debate-timer` |
| The video library (LEARN) | `packages/debate-videos` |
| Team prep, task inbox, prep room | `packages/debate-team-collaboration` |
| Leaderboards, quests, contributor awards | `packages/debate-contributor-progress` |
| AI prompts for speeches and flows | `packages/debate-speech-writer` |
| Shared UI primitives, icons, `cn` | `packages/debate-ui` |
| Routes, `/api`, auth, D1 schema, the Worker | `apps/debate-ai.com` |
| User-facing documentation | `packages/debate-help-docs` |

Full map: [`architecture/overview.md`](.claude/architecture/overview.md).

## Commands

```bash
bun install
bun run dev                    # turbo dev
bun run dev:web                # just the web app
bun run build
bun run typecheck
bun run test                   # one Vitest run across every package
bun run coverage               # merged coverage/lcov.info
```

## Before you open a PR

- Run `bun run typecheck` and `bun run test` — that is exactly what CI runs.
- Update `packages/README.md` when a package's purpose or dependencies change;
  it is the index everyone reads first, and the docs site publishes it.
- Update the package's own `CLAUDE.md` when its boundaries change.
- Commit style is **gitmoji + conventional commits**:
  `✨ feat(scope): what changed`. See
  [`architecture/conventions.md`](.claude/architecture/conventions.md).
- Target `master`. Keep the PR focused; no drive-by refactors.

## Detailed notes

| Note | Covers |
| --- | --- |
| [overview.md](.claude/architecture/overview.md) | The product, every package, and the dependency edges between them |
| [monorepo.md](.claude/architecture/monorepo.md) | Workspaces, the apps that aren't workspaces, turbo, the single Vitest config |
| [web-app.md](.claude/architecture/web-app.md) | The deployed Cloudflare app: Worker, D1, crons, the service worker, deploy |
| [documentation.md](.claude/architecture/documentation.md) | Where docs live and how `/docs` is built into the app |
| [conventions.md](.claude/architecture/conventions.md) | Code style, commits, PRs, CI, publishing, security |
