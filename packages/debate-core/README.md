# debate-core

The pieces every other debate package shares:

- `types/flow` — the `Box` / `Flow` / `Round` domain types plus round title and slug helpers.
- `client-cache` — a browser-side, Fuse-backed cache over the tournament, school and
  debater-name endpoints, so autocompletes hit the network once per session.

```ts
import type { Flow, Round } from "debate-core/types/flow"
import { searchTournaments, searchSchools } from "debate-core/client-cache"
```

This package deliberately has no React or UI dependencies — it sits at the bottom of the
dependency graph so `debate-round`, `debate-timer` and `debate-card-search` can all use it.
