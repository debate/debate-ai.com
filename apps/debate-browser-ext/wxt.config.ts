import { fileURLToPath } from 'node:url';
import { defineConfig } from 'wxt';

/** A file inside the `debate-ai-webui` package. */
const webui = (path: string) =>
  fileURLToPath(new URL(`../../packages/debate-ai-webui/${path}`, import.meta.url));

/**
 * The AI provider APIs the article panel calls directly when the reader has
 * pasted their own key (src/ai/providers.ts). An extension page may call these
 * without a CORS preflight only if their origins are granted here.
 *
 * They are listed rather than requested at runtime so that what the extension
 * can reach is visible in one place, in the manifest, to anyone reviewing it.
 * Nothing is sent to any of them unless the reader has both chosen that
 * provider and stored a key for it.
 */
const AI_PROVIDER_HOSTS = [
  'https://openrouter.ai/*',
  'https://api.openai.com/*',
  'https://api.anthropic.com/*',
  'https://generativelanguage.googleapis.com/*',
];

// See https://wxt.dev/api/config.html
export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  // The Options page is the whole debate-ai.com app (`debate-ai-webui`),
  // which — like the feature packages it mounts — imports `next/link`,
  // `next/navigation` and `next/image`. There is no Next here: those resolve
  // to the package's shims, which route through the URL fragment instead.
  //
  // Workspace packages declare React as a peer, and bun's isolated
  // node_modules gives each its own resolution of it; two React copies in one
  // bundle is "invalid hook call", so `react`/`react-dom` resolve once, from
  // this app.
  vite: () => ({
    define: {
      // The app reads a few `NEXT_PUBLIC_*` values that Next inlines at build
      // time; everything else in `process.env` is simply absent here.
      'process.env.NEXT_PUBLIC_APP_URL': JSON.stringify('https://debate-ai.com'),
      'process.env.NEXT_PUBLIC_BASE_URL': JSON.stringify('https://debate-ai.com'),
      'process.env': '{}',
    },
    resolve: {
      dedupe: ['react', 'react-dom'],
      alias: [
        { find: /^next\/link$/, replacement: webui('src/next/link.tsx') },
        { find: /^next\/navigation$/, replacement: webui('src/next/navigation.tsx') },
        { find: /^next\/image$/, replacement: webui('src/next/image.tsx') },
        // The separately-versioned card-cutter engine is never shipped; the web
        // app resolves it to the same in-repo stub (apps/debate-ai.com/vite.config.ts).
        {
          find: '@cardcutter/browser',
          replacement: fileURLToPath(
            new URL('../../packages/debate-editor/src/editor/card-cutter-stub.ts', import.meta.url)
          ),
        },
      ],
    },
    build: {
      // The app is large (the research workspace alone is several MB); it is
      // loaded from disk, route by route, so the web-sized warning says nothing.
      chunkSizeWarningLimit: 8000,
    },
  }),
  // `wxt dev` launches a browser via chrome-launcher, which only auto-detects
  // "Google Chrome" / "Chromium". This machine only has Chrome Beta installed,
  // so point the dev runner at it explicitly.
  runner: {
    binaries: {
      chrome:
        '/Applications/Google Chrome Beta.app/Contents/MacOS/Google Chrome Beta',
    },
  },
  manifest: ({ browser }) => ({
    name: 'Debate AI — Reader, Timer & Card Reuse Check',
    description:
      'Critical times call for critical thinking! Read any page in an AI article panel, time a round, and check whether a card has already been cut from the page.',
    // Kept from the original timer manifest so the extension ID (and therefore
    // the user's existing chrome.storage data) stays stable across both the
    // WXT migration and the merge with the card-reuse extension. debate-ai.com
    // also derives the extension's origin from this key in order to trust it
    // for sign-in — see its lib/config/site.ts EXTENSION_ID.
    key: 'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAjrcSiPHdMYVhqXi8/Dhktfs6019hLifp6cQm9hs3VToy+5tb3QcHwpX1H+Pc/Jf9G12oO6a3N2FE7Yz3RGI/eOpLhnmftWLpGK6k09cULjSWYjWi1RhijhZ4BkmNkU1A2wgECHs0fnnTBnZovMffFcLnkmtuatCetfGXmhwZzbqfAQwGrLtdtt2g09s7VCPv9YCJlzswx74CoLmAjGSRdHf/ZIX8QqsUQR4ATor/KcKn60sNLV/Ef395OtdN3VkD0IkB6pbtqpG7UxMYmGixapYeKRQMPS4IUlrc5RchoYKA1VUGQkMwsTI10159vBre70+MKrE9EJ2lYguHgKrYEwIDAQAB',
    permissions: [
      // The timer's session/timeline and the shared settings.
      'storage',
      // The popup's reuse check reading the current page's URL, and — the
      // reason it is enough for the article panel too — permission to read
      // the page the reader just opened the panel on. `activeTab` is granted
      // per user action, which is why the panel needs no access to every site.
      'activeTab',
      // Reading that page's HTML out of the tab (src/reader/snapshot.ts).
      // MV3 only: the Firefox build is MV2, where the same job is done by
      // `tabs.executeScript` under `activeTab` and there is no such permission.
      ...(browser === 'firefox' ? [] : ['scripting']),
      // Right-click → "Read this page" / "Check this page for existing cards".
      'contextMenus',
      // Pinging debate-ai.com with the stored session so a signed-in reader
      // stays signed in (src/auth/session.ts).
      'alarms',
      // Chrome's side panel, where the article panel lives. Firefox uses
      // `sidebar_action`, which WXT derives from the sidepanel entrypoint and
      // which needs no permission entry.
      ...(browser === 'firefox' ? [] : ['sidePanel']),
    ],
    // The deployments the reuse check, sign-in and account-backed AI may call
    // (see the Options page), plus the model providers above.
    host_permissions: [
      'https://debate-ai.com/*',
      'http://localhost:3000/*',
      ...AI_PROVIDER_HOSTS,
    ],
    // `action.default_popup` (and its title, from the popup's <title>) come
    // from entrypoints/popup; the background worker swaps the popup out when
    // the toolbar icon is configured to open the timer window or the article
    // panel instead.
    icons: {
      16: '/icon/16.png',
      32: '/icon/32.png',
      48: '/icon/48.png',
      96: '/icon/96.png',
      128: '/icon/128.png',
    },
  }),
});
