# Conventions and General Rules

## Language and style

- TypeScript throughout, ESM. React for every UI package.
- Match the surrounding file's style — naming, import order, comment density.
  There is no repo-wide formatter enforcing it in CI.
- **Comments explain why, not what.** The valuable comments here record a
  constraint and its cause: why `keep_vars` must stay in `wrangler.jsonc`, why
  `packages/README.md` is excluded from the Vitest projects, why the web app's
  test project is registered inline with the `@/` alias. `vitest.config.ts` and
  `wrangler.jsonc` are the house style — copy that register.
- Keep package boundaries clean: import a sibling from its public entry point,
  never from its internals or its `src/`. The edges between the `debate-*`
  packages are documented in [overview.md](overview.md) — adding a new one is a
  decision, not a detail.

## Commits

Gitmoji + conventional commits, lowercase subject, imperative mood. Recent
history is the reference:

```
✨ feat(nav): make Ctrl/Cmd-Shift-Space a real app-wide command palette
⏰ feat(videos): make the weekly cron refresh view counts, not just scan for new videos
🐛 fix(cards): repair the merge that crashed /cards and /reason-editor
🐛 fix(shell): bound each chrome region so one crash can't 500 a route
```

Scope is the package or surface name without its `debate-` prefix.

## Pull requests

- Target `master`. One concern per PR; no drive-by refactors.
- Say what changed, why, and which packages are affected — especially if you
  touched `debate-ui`, `debate-search-evidence` or `debate-round`, which several
  packages build on.
- **Say explicitly if you changed `apps/debate-web-ext` or
  `apps/debate-native-wrapper`** — they are outside the workspace, so nothing in
  the root CI will catch a break.
- Include test results; screenshots for UI changes.
- If you could not run a check, say so and why.

## Tests

- Add or update tests for every behaviour change and bug fix.
- **Package tests go in `packages/<dir>/test/`.** App tests go in
  `apps/debate-ai.com/lib/**/__tests__/`. Anywhere else and nothing runs them.
- One Vitest config for the whole repo, at `apps/debate-ai.com/vitest.config.ts`
  — see [monorepo.md](monorepo.md). Don't add another.
- `bun run typecheck && bun run coverage` is exactly what CI runs.
- Tests run under Node. Passing tests do **not** prove the code runs on a
  Cloudflare Worker; see [web-app.md](web-app.md).

## CI

| Workflow | Trigger | What it guards |
| --- | --- | --- |
| `test.yml` | push to `master`, PR | `bun install --ignore-scripts`, `bun run typecheck`, `bun run coverage`, upload to Codecov |
| `npm-release.yml` | manual (`workflow_dispatch`, with a dist-tag input) | Publishes **`debate-api-client`** — the only published package |
| `native-wrapper-ci.yml` / `native-wrapper-release.yml` | — | `apps/debate-native-wrapper` (Tauri), which the root CI never touches |
| `auto-merge-claude.yml` | PR | Auto-merge/approve on Claude PRs |
| `auto-merge-and-create-prs.yml` | schedule | Merges eligible PRs, opens PRs for branches without one |

## Publishing

Only `debate-api-client` publishes, and only when someone runs the workflow by
hand with a dist-tag. Everything else is `"private": true`.

## Security and user data

- Never commit secrets, credentials or API keys. Worker secrets go in via
  `wrangler secret put` (`apps/debate-ai.com/setup-secrets.sh` helps).
- **This product's users include minors** — high-school debaters. Team rosters,
  prep notes, speech recordings and round history are personal data. Do not add
  logging that captures speech content, recordings, or identifiable round data,
  and do not widen a sharing default.
- Uploaded evidence files (`.docx`, including encrypted Verbatim files) are
  untrusted input. `debate-card-parser` and `debate-editor` parse them — treat
  malformed and hostile documents as expected, not exceptional.
