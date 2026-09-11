# Conventions and General Rules

## Language and style

- TypeScript throughout, ESM. Rust only in `apps/debate-native-wrapper/src-tauri`.
- Match the surrounding file's style — naming, import order, comment density.
  There is no repo-wide formatter enforcing it in CI.
- **This codebase documents heavily in file headers.** Most modules open with a
  `@fileoverview` block that says what the module is for, which Known gap it
  closes, and what it deliberately does *not* do. Write in that register: why,
  not what, and name the doc page the change answers to.
- Keep package boundaries clean: import a sibling from its public entry point.

## Commits

Gitmoji + conventional commits, lowercase subject, imperative mood:

```
✨ feat(videos): read transcripts as sentences, cache them in D1
🐛 fix(reason-editor): stop the DOM-only dependency builds that 500 the homepage
⏰ feat(videos): make the weekly cron refresh view counts, not just scan
🔗 feat(reason-docs): address documents by name, not by id
📝 docs(ci): record the lockfile outage blocking every job
```

Scope is the package or feature area. Version-bump commits are generated — do not
write them by hand.

## Pull requests

- Target `master`. One concern per PR; no drive-by refactors.
- Say what changed, why, and which packages are affected.
- Link issues with `Fixes #123`; screenshots for UI changes.
- If you could not run a check, say so and why.

## Tests and type-checking

```bash
bun run typecheck    # turbo typecheck across every package — a CI gate
bun run test         # vitest
bun run coverage     # vitest + coverage, as CI runs it
bun run build        # turbo build
```

`typecheck` blocks CI just as hard as the test suite, and it is the faster of the
two — run it first. The root `test` script points at
`apps/debate-ai.com/vitest.config.ts`, which is where the suite is configured.

Add or update tests for every behaviour change and bug fix. Tests run under Node;
passing tests do **not** prove the code runs on a Cloudflare Worker.

## CI

| Workflow | Trigger | What it guards |
| --- | --- | --- |
| `test.yml` | push to master, PR | `bun run typecheck` then `bun run coverage`, uploaded to Codecov |
| `native-wrapper-ci.yml` | changes to the wrapper | Builds the Tauri app |
| `native-wrapper-release.yml` | release | Signs and publishes desktop/mobile builds |
| `npm-release.yml` | push to master | Publishes changed public packages |
| `auto-merge-*.yml` | schedule / PR | Merges PRs that are clean, approved and green |

CI installs with `bun install --ignore-scripts` and `bun-version: 1.3.11`. A
lockfile that only converges under a different bun will fail the Cloudflare build.

## Security

- Never commit secrets, credentials, API keys, private keys or build output.
  `public/docs` and other generated output are gitignored — keep it that way.
- Worker secrets go through `wrangler secret put` (see
  `apps/debate-ai.com/setup-secrets.sh`), not `vars` and not the repo. Plaintext
  dashboard Variables survive deploys only because of `keep_vars` — see
  [web-app.md](web-app.md).
- The license is PROSPER (`LICENSE.md`); contributions are under it.

## Agent-specific rules

- Do not create a root `docs/` folder — see [documentation.md](documentation.md).
- Update **both** the `features/` page and the `internals/` note for any
  behaviour change, and close the Known gap you actually closed.
- Do not run `npm`/`yarn`/`pnpm` at the repo root.
- `app/` routes and `/api` handlers should stay thin; put logic in a package.
- When adding a localStorage-backed tool, check whether it needs an entry in
  `TOOL_RECORD_COLLECTIONS` so it syncs across devices — see
  [overview.md](overview.md).
