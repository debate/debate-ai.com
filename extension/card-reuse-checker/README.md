# Card Reuse Checker (browser extension)

Closes follow-up (a) under the "On Page Card Reuse Search" idea in the root
[`TODO.md`](../../TODO.md)'s Product Feature Ideas list — "an actual browser
extension that calls this same check automatically against the current
tab's URL". See `docs/features/on-page-card-reuse-search.md` for the full
feature writeup.

A one-click check for whether the page you're reading has already been cut
into the [Shared Evidence Library](../../docs/features/evidence-library.md),
so you don't duplicate work someone else already did.

## How it works

The Shared Evidence Library is persisted in `debate-ai.com`'s own browser
localStorage — a different origin the extension can't read directly, and
this repo has no server-side API for it. So instead of re-implementing the
check against data it has no access to, the extension deep-links into the
app's own `/cards/library?checkUrl=<the current tab's URL>`, which runs the
same check the page's "Check this page" box already runs manually (see
`buildReuseCheckDeepLink` in
`packages/debate-card-search/src/lib/shared-evidence-library.ts`, and where
`EvidenceLibraryPanel` reads that `checkUrl` param on mount).

`deep-link.js`'s `buildReuseCheckDeepLink` mirrors the Vitest-covered
TypeScript original of the same name — this extension has no build step and
can't import a workspace package directly, so keep the two in sync if
either changes.

## Install (unpacked, no store listing)

1. Open `chrome://extensions` (or the equivalent in another Chromium
   browser — Edge, Brave, Opera).
2. Enable "Developer mode" (top right).
3. Click "Load unpacked" and select this `extension/card-reuse-checker`
   folder.

## Use

Click the extension's toolbar icon on any page, then "Check this page for
existing cards" — it opens a new tab at `/cards/library` with the page's
URL already filled in and checked.

## Settings

By default the extension checks against `https://debate-ai.com`. Right-click
the toolbar icon → "Options" (or open it from the popup's "Settings" link)
to point it at a self-hosted or local-dev deployment instead.

## Known gaps

- Not published to the Chrome Web Store or Firefox Add-ons — "Load unpacked"
  only, matching this repo not having a store-publishing pipeline.
- No automated tests — a Chrome-extension-API-driven UI isn't exercisable in
  this repo's Vitest/jsdom setup. The URL-building logic it depends on
  (`buildReuseCheckDeepLink`) is fully Vitest-covered in
  `packages/debate-card-search/test/shared-evidence-library.test.ts`; this
  extension's `deep-link.js` is a manually-kept-in-sync mirror of it.
- No icons — Chrome shows a generic placeholder toolbar icon; a real
  extension icon set was out of scope for this slice.
