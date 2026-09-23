# Monorepo Mechanics

## Workspaces

```json
"workspaces": ["packages/*", "apps/debate-ai.com", "apps/debate-web-ext"]
```

Read that again: **`apps/*` is not globbed.** The apps are listed one by one,
and `apps/debate-native-wrapper` is not among them — a root `bun install` does
not install it, turbo does not fan out into it, and the root test run never
reaches it. It has its own CI (`native-wrapper-ci.yml`,
`native-wrapper-release.yml`) and is installed and built from inside its own
directory.

If you change it, say so explicitly in the PR: nothing at the root will catch
a break.

`apps/debate-web-ext` joined the workspace when its Options page started
mounting `debate-ai-webui` — sharing a workspace package is the whole reason,
since a `file:` dependency cannot resolve that package's own `workspace:*`
deps. Two consequences worth knowing before touching it:

- It is pinned to **React 18** while everything else is on 19, and bun's
  isolated `node_modules` gives a shared package its own resolution of `react`.
  The extension dedupes `react`/`react-dom` in `wxt.config.ts` (for the bundle)
  and in `tsconfig.json`'s `paths` (for types). Remove either and you get
  "invalid hook call" at runtime and "not a valid JSX element type" on every
  lucide icon at build time.
- It has no `postinstall`. `wxt prepare` runs from its `typecheck`/`dev`/
  `build` scripts instead, so a root install never runs this app's scripts.

The root `typecheck` does now reach it, which is one less thing nothing at the
root catches.

## Root `dependencies`

Unusually, the root `package.json` carries real runtime dependencies
(`grab-url`, `linkedom`, `htmlparser2`, `jszip`, `docx-preview`,
`@cloudflare/vite-plugin`) rather than only devDependencies, plus an
`overrides` entry pinning `@ricky0123/vad-web`. They are hoisted for the
packages that share them. Before adding a dependency to the root, check whether
it belongs in the one package that uses it.

## Packages are consumed as source, not `dist`

Unlike the sibling repos, almost every package here points `main` straight at
its TypeScript source (`./src/index.ts`, or a `.tsx` entry for
`debate-editor` and `debate-flow`). There is **no build step to forget** — an
edit to `packages/debate-round/src` is live in the app immediately.

The one exception is **`debate-api-client`**, which is built (`./dist/index.js`)
because it publishes to npm. Rebuild that one after editing it.

A few packages expose subpath exports rather than a single barrel — import from
the subpath, not through the internals:

| Package | Subpaths |
| --- | --- |
| `debate-editor` | `./engine`, `./settings`, `./settings-ui`, `./settings-categories`, `./collab-bridge`, `./styles.css` |
| `debate-flow` | `./settings-panel`, `./store`, `./tools`, `./tooltip`, `./styles/ebb-scope.css` |
| `debate-round-practice-ai` | `./backend`, `./client`, `./ui` |

## Names

Turbo filters take the **package name**, and five directories don't match:

| Directory | Package name |
| --- | --- |
| `debate-contributor-progress` | `debate-community` |
| `debate-flow` | `debate-flow-ebb` |
| `debate-practice-drills` | `debate-practice-rounds` |
| `debate-round-practice-ai` | `debate-practice-vs-ai` |
| `debate-search-evidence` | `debate-research-evidence` |

## Turbo task graph

| Task | Notes |
| --- | --- |
| `build` | `dependsOn: ["^build"]`; outputs `dist/`, `.next/` (minus cache) |
| `typecheck` | `dependsOn: ["^typecheck"]` — note it chains typecheck, not build |
| `test` | `dependsOn: ["^build"]`, no outputs |
| `coverage` | `dependsOn: ["^build"]`; outputs `coverage/` |
| `dev` | `cache: false`, `persistent: true` |

Root shortcuts: `dev:web` / `build:web` filter to `debate-ai-web`.

`dev:editor` and `build:editor` filter to **`reason-editor`, which is not a
package in this repo** — the editor package is `debate-editor`. Those two
scripts match nothing and exit without doing anything; they are stale, not a
workflow you are missing.

## One Vitest config for the whole repo

There is exactly one, and it is **not** at the root:
`apps/debate-ai.com/vitest.config.ts`. That is deliberate — the repo root is
kept free of tool configs. Do not add a root `vitest.config.ts`, and do not add
per-package ones.

How it works:

- `root` is pinned to the repo root, so the globs resolve the same way no matter
  which directory Vitest runs from.
- Every `packages/*` directory is registered as a **project**, so one
  `bun run test` runs each package's **`test/` folder** and one
  `bun run coverage` produces a single merged `coverage/lcov.info`.
- Two exclusions: `packages/README.md` (which the `packages/*` glob would
  otherwise match as a project entry) and `packages/debate-help-docs` (a
  Fumadocs site, not a tested library).
- The web app is registered **inline** as an extra project — it has no `test/`
  folder, but parts of `apps/debate-ai.com/lib` are plain Node libraries worth
  unit testing (the D1 read-replication session wrapper, for one). That project
  carries the app's own `@/` alias so a module under test resolves imports the
  way the app does, and includes `.tsx` as well as `.ts` because the shell's
  error boundary is only meaningful as a rendered tree.

Consequences for you:

- **Put a package's tests in `packages/<dir>/test/`.** A test somewhere else is
  not picked up by anything.
- **App tests go in `apps/debate-ai.com/lib/**/__tests__/*.test.ts(x)`** — that
  is the only include pattern for the app.
- Coverage counts `packages/*/src/**/*.{ts,tsx}` only; `debate-data-sync`'s
  `data/` and `schemas/` are excluded as pure assets.

## CI

`test.yml`, on push to `master` and on PRs:

```bash
bun install --ignore-scripts
bun run typecheck      # every package
bun run coverage       # every package's suite, merged
```

Then upload to Codecov and as an artifact. Running those two commands locally is
running CI.
