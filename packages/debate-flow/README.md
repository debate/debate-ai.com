# debate-flow-ebb

Local-first, keyboard-first flow editor package. `EbbFlowEmbed` mounts the ebb flow grid
inside host pages such as `debate-round`'s live round editor, while keeping the editor's
state, bridge, palette, and scoped styles in this workspace package.

## Package layout

Logic lives under `src/`, grouped by role.

```
debate-flow-ebb/
└── src/              # Ebb flow embed, components, store, bridge, and scoped styles
```

## Tests

```bash
bun run typecheck   # or: npx tsc --noEmit
```

Coverage for every package is merged at the repo root by `bun run coverage` and uploaded
to [Codecov](https://app.codecov.io/gh/debate/debate-ai.com) by CI.

Current Codecov package coverage on `master` at commit `50322f5` is **0.00%** (tracked under
the `debate-flow` flag) — this package has no `test/` directory yet.
