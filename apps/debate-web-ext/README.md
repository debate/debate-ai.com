# Debate AI — Card Reuse Check (browser extension)

A Manifest V3 browser extension implementing the last open follow-up of
TODO.md idea #7 ("On Page Card Reuse Search"): checking, for the page a
debater currently has open, whether the team has already cut a card from it
— against `debate-ai.com`'s server-backed shared reuse index
(`/api/evidence-reuse-check`, see
[`../../docs/features/evidence-library.md`](../../docs/features/evidence-library.md#on-page-card-reuse-check)),
not just what's saved in one browser's own `localStorage`.

This is deliberately a small, dependency-free extension — plain HTML/JS,
no bundler, no framework — so it needs no build step and isn't part of this
repo's `bun`/`turbo` workspaces.

## Loading it locally (Chrome/Edge/Brave)

1. Open `chrome://extensions`.
2. Enable "Developer mode" (top right).
3. Click "Load unpacked" and select this `apps/browser-extension` folder.
4. Click the extension's toolbar icon on any page to check it.

By default the extension checks against `https://debate-ai.com`. To point
it at a different deployment (e.g. `http://localhost:3000` during local
development), open the extension's Options page (the popup's "Settings"
link) and change the API base URL — only the production domain and
`http://localhost:3000` are pre-authorized in `manifest.json`'s
`host_permissions`, so a different host needs the manifest updated (and the
extension reloaded) first.

The Options page also has a **skip-check whitelist**: one domain per line
(e.g. an internal team wiki, a general reference site) the popup always
skips without a network request, showing a neutral "on your skip-check
whitelist" status instead — a subdomain of a listed domain is skipped too.

## Files

- `manifest.json` — Manifest V3 declaration (`action` popup, `options_page`, `host_permissions`).
- `popup.html`/`popup.js` — the toolbar popup: reads the active tab's URL and renders the reuse-check result.
- `options.html`/`options.js` — lets a contributor change the configured API base URL and the skip-check domain whitelist.
- `api.js` — shared fetch helper against `/api/evidence-reuse-check`, mirroring `packages/debate-card-search/src/lib/evidence-reuse-check-client.ts`'s request/response shape.

## Known gaps

- No automated tests (no test runner is wired up for this plain-JS extension) — verified manually via "Load unpacked".
- Registering a newly-cut card into the shared index (`POST /api/evidence-reuse-check`) only happens from the web app's Evidence Library submission form today, not from this extension — the extension is check-only.
