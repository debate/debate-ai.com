// Mirrors `buildReuseCheckDeepLink` in
// `packages/debate-card-search/src/lib/shared-evidence-library.ts`
// (Vitest-covered there). Duplicated here in plain JS because a browser
// extension can't import a TypeScript workspace package without a bundler,
// and the app itself has no public API this extension could call instead —
// the evidence repository is persisted in the app's own localStorage, so
// the extension deep-links into `/cards/library` with the tab's URL
// pre-filled instead of re-implementing the check itself. Keep this in
// sync with the TS original if either changes.
function buildReuseCheckDeepLink(appOrigin, pageUrl) {
  const origin = appOrigin.trim().replace(/\/+$/, "");
  return `${origin}/cards/library?checkUrl=${encodeURIComponent(pageUrl.trim())}`;
}

const DEFAULT_APP_ORIGIN = "https://debate-ai.com";
