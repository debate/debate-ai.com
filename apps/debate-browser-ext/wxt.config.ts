import { fileURLToPath } from 'node:url';
import { defineConfig } from 'wxt';

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
  // `debate-ai-webui` is a workspace package with React as a peer dependency,
  // so bun's isolated node_modules gives it its own resolution of `react` —
  // the monorepo's React 19, next to this extension's React 18. Two React
  // copies in one bundle means the shell's hooks run against a different
  // dispatcher than the page's ("invalid hook call"), so every `react` and
  // `react-dom` specifier is resolved once, from this app's own dependency.
  //
  // `debate-api-client` (reached through `debate-ai-webui`) publishes compiled
  // `dist/` output that only exists after that package's own build, so a plain
  // `bun run build` here failed with "Failed to resolve entry for package".
  // Bundling its TypeScript source instead makes this build self-contained.
  vite: () => ({
    resolve: {
      dedupe: ['react', 'react-dom'],
      alias: {
        'debate-api-client': fileURLToPath(
          new URL('../../packages/debate-api-client/src/index.ts', import.meta.url)
        ),
      },
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
