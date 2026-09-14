# Monorepo Mechanics

## Workspaces

```json
"workspaces": ["packages/*", "apps/debate-ai.com"]
```

Read that second entry again: **`apps/*` is not globbed.** Only the web app is a
workspace. `apps/debate-native-wrapper` and `apps/debate-web-ext` are outside —
a root `bun install` does not install them, turbo does not fan out into them,
and the root test run never reaches them. They have their own CI
(`native-wrapper-ci.yml`, `native-wrapper-release.yml`) and are installed and
built from inside their own directories.

If you change one of them, say so explicitly in the PR: nothing at the root will
catch a break.

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
