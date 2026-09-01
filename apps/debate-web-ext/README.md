# Debate AI — Card Reuse Check (browser extension)

A Manifest V3 browser extension implementing the last open follow-up of
TODO.md idea #7 ("On Page Card Reuse Search"): checking, for the page a
debater currently has open, whether the team has already cut a card from it
— against `debate-ai.com`'s server-backed shared reuse index
(`/api/evidence-reuse-check`, see
[`../../docs/features/evidence-library.md`](../../docs/features/evidence-library.md#on-page-card-reuse-check)),
not just what's saved in one browser's own `localStorage`.

Built with [WXT](https://wxt.dev) and React, and part of this repo's
`bun`/`turbo` workspaces.

## Development

From the repo root (or this directory):

```sh
bun run --filter debate-web-ext dev
```

This opens a browser with the extension loaded and hot-reloading. Use
`dev:firefox` for Firefox instead of Chrome.

## Building

```sh
bun run --filter debate-web-ext build
```

Output goes to `.output/<browser>-mv3/`. Load that folder as an unpacked
extension (`chrome://extensions` → Developer mode → Load unpacked), or run
`bun run --filter debate-web-ext zip` to produce a distributable `.zip`.

By default the extension checks against `https://debate-ai.com`. To point
it at a different deployment (e.g. `http://localhost:3000` during local
development), open the extension's Options page (the popup's "Settings"
link) and change the API base URL — only the production domain and
`http://localhost:3000` are pre-authorized in `wxt.config.ts`'s
`host_permissions`, so a different host needs that updated (and the
extension rebuilt/reloaded) first.

## Files

- `wxt.config.ts` — WXT config: manifest `permissions`/`host_permissions`, and the `@wxt-dev/module-react` module.
- `entrypoints/popup/` — the toolbar popup: reads the active tab's URL and renders the reuse-check result.
- `entrypoints/options/` — lets a contributor change the configured API base URL; opens as a full tab (`meta name="manifest.open_in_tab"`).
- `utils/api.ts` — shared storage + fetch helpers against `/api/evidence-reuse-check`, mirroring `packages/debate-card-search/src/lib/evidence-reuse-check-client.ts`'s request/response shape.

## Known gaps

- No automated tests — verified manually via "Load unpacked".
- Registering a newly-cut card into the shared index (`POST /api/evidence-reuse-check`) only happens from the web app's Evidence Library submission form today, not from this extension — the extension is check-only.
