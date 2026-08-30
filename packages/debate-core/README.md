# debate-core

The pieces every other debate package shares:

- `src/types/flow` — the `Box` / `Flow` / `Round` domain types plus round title and slug helpers.
- `src/cache/client-cache` — a browser-side, Fuse-backed cache over the tournament, school and
  debater-name endpoints, so autocompletes hit the network once per session.

```ts
import type { Flow, Round } from "debate-core/src/types/flow"
import { searchTournaments, searchSchools } from "debate-core/src/cache/client-cache"
```

This package deliberately has no React or UI dependencies — it sits at the bottom of the
dependency graph so `debate-round`, `debate-timer` and `debate-card-search` can all use it.

## Package layout

Logic lives under `src/`, grouped by role; tests live under `test/`.

```
debate-core/
├── src/
│   ├── cache/        # Fuse-backed tournament / school / name lookup cache
│   ├── types/        # Box, Flow, Round domain types and title/slug helpers
│   └── index.ts      # public entry point
└── test/             # Vitest suites for the lookup cache
```

## Tests

```bash
bun run test        # or: npx vitest run
bun run coverage    # writes ./coverage for this package alone
```

Suites live in `test/` and mirror the `src/` layout. Coverage for every package is
merged at the repo root by `bun run coverage` and uploaded to
[Codecov](https://app.codecov.io/gh/debate/debate-ai.com) by CI.

Current Codecov package coverage on `master` at commit `5b69dad` is **73.24%**.
