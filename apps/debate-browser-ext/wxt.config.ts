import { fileURLToPath } from 'node:url';
import { defineConfig, type WxtUnimportOptions } from 'wxt';
import { createPackageFileResolver, noRemoteCode } from './vite/no-remote-code';
import { stubNodeBuiltins } from './vite/stub-node-builtins';

/** A file inside the `debate-webview` package. */
const webui = (path: string) =>
  fileURLToPath(new URL(`../../packages/debate-webview/${path}`, import.meta.url));

const repoRoot = fileURLToPath(new URL('../../../', import.meta.url));
const workspaceDirs = [
  fileURLToPath(new URL('../../packages/debate-webview', import.meta.url)),
  fileURLToPath(new URL('../../packages/debate-editor', import.meta.url)),
  fileURLToPath(new URL('../../packages/debate-round', import.meta.url)),
  fileURLToPath(new URL('../../packages/debate-videos', import.meta.url)),
  fileURLToPath(new URL('../../packages/debate-speech-writer', import.meta.url)),
  fileURLToPath(new URL('../../packages/debate-timer', import.meta.url)),
  fileURLToPath(new URL('../../packages/debate-tournaments', import.meta.url)),
  fileURLToPath(new URL('../../packages/debate-flow', import.meta.url)),
  fileURLToPath(new URL('../../packages/debate-search-evidence', import.meta.url)),
  fileURLToPath(new URL('../../packages/debate-rankings-adapter', import.meta.url)),
];

const resolveFile = createPackageFileResolver(repoRoot, workspaceDirs);

/**
 * Where the CDN scripts that `debate-webview`'s libraries would fetch are
 * found locally instead (see vite/no-remote-code.ts): this app, the webview
 * package, the feature package that owns the editor, and the repo root.
 */
const resolveLocalPackageFile = createPackageFileResolver(
  fileURLToPath(new URL('../../', import.meta.url)),
  [
    fileURLToPath(new URL('./', import.meta.url)),
    webui(''),
    fileURLToPath(new URL('../../packages/debate-editor/', import.meta.url)),
  ]
);

/**
 * The AI provider APIs the article panel calls directly with the OpenRouter or
 * Anthropic key the reader saved in the app's own settings
 * (src/ai/providers.ts, src/ai/app-key.ts). An extension page may call these
 * without a CORS preflight only if their origins are granted here.
 *
 * They are listed rather than requested at runtime so that what the extension
 * can reach is visible in one place, in the manifest, to anyone reviewing it.
 * Nothing is sent to either unless the reader has saved a key for it.
 */
const AI_PROVIDER_HOSTS = ['https://openrouter.ai/*', 'https://api.anthropic.com/*'];

// See https://wxt.dev/api/config.html
export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  // WXT auto-imports its globals (`defineBackground`, `browser`, `storage`, …)
  // into any module that uses one of those names unbound — including the
  // workspace packages the Options page bundles. @debate-ai/round's flow history
  // takes a parameter called `storage`, which got an injected
  // `import { storage } from 'wxt/storage'` that can't resolve from
  // packages/, failing the build. Auto-imports are for this extension's own
  // code only. (`exclude` is passed straight to unimport's Vite plugin; WXT's
  // type just doesn't list the plugin's filter options.)
  imports: {
    exclude: [/[\\/]node_modules[\\/]/, /[\\/]\.git[\\/]/, /[\\/]packages[\\/]/],
  } as WxtUnimportOptions,
  // The Options page is the whole debate-ai.com app (`debate-webview`),
  // which — like the feature packages it mounts — imports `next/link`,
  // `next/navigation` and `next/image`. There is no Next here: those resolve
  // to the package's shims, which route through the URL fragment instead.
  //
  // Workspace packages declare React as a peer, and bun's isolated
  // node_modules gives each its own resolution of it; two React copies in one
  // bundle is "invalid hook call", so `react`/`react-dom` resolve once, from
  // this app.
  vite: () => ({
    // Chrome Web Store: no remotely hosted code. Every CDN script URL the
    // bundled libraries carry is pointed at a copy shipped in the extension.
    // api2client's Node-only codegen is stubbed out (vite/stub-node-builtins.ts).
    plugins: [stubNodeBuiltins(), noRemoteCode(resolveFile)],
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
        // A single `debate-webview` module, as its source file (the package's
        // `./*` export has no extension for Vite to resolve).
        { find: /^@debate\/webview\/lib\/(.*)$/, replacement: webui('src/lib/$1') },
        // A single `debate-webview` module, as its source file (the package's
        // `./*` export has no extension for Vite to resolve).
        { find: /^@debate\/webview\/lib\/(.*)$/, replacement: webui('src/lib/$1') },
        // `debate-qwksearch`'s connect helpers, as source for the same reason.
        {
          find: /^@debate-ai\/qwksearch\/lib\/(.*)$/,
          replacement: fileURLToPath(new URL('../../packages/debate-qwksearch/src/lib/$1', import.meta.url)),
        },
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
  webExt: {
    binaries: {
      chrome:
        '/Applications/Google Chrome Beta.app/Contents/MacOS/Google Chrome Beta',
    },
  },
  manifest: ({ browser, manifestVersion }) => ({
    name: 'Debate AI',
    description:
      'Read any page in an AI article panel, time a round, and check whether a card has already been cut from the page.',
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
      // Reading that page's HTML out of the tab (src/reader/snapshot.ts), and
      // putting the article panel's overlay on it (src/reader/panel.ts).
      // MV3 only: the Firefox build is MV2, where the same job is done by
      // `tabs.executeScript` under `activeTab` and there is no such permission.
      ...(browser === 'firefox' ? [] : ['scripting']),
      // Right-click → "Read this page in Debate AI".
      'contextMenus',
      // Pinging debate-ai.com with the stored session so a signed-in reader
      // stays signed in (src/auth/session.ts).
      'alarms',
      // Lifts the quota on this extension's storage — `chrome.storage.local`
      // and the IndexedDB the Options page (the whole app) keeps its flows,
      // rounds and history in. debate-ai.com mirrors that same data in here
      // over the bridge below (src/storage/bulk-storage-bridge.ts), so a
      // reader with the extension never runs out of room for their work.
      'unlimitedStorage',
    ],
    // Lets debate-ai.com (and only it, plus localhost for development) message
    // the background worker's storage bridge. Chromium only.
    ...(browser === 'firefox'
      ? {}
      : {
          externally_connectable: {
            matches: ['https://debate-ai.com/*', 'http://localhost:3000/*'],
          },
        }),
    // The page-tools content script (entrypoints/page-tools.content.ts) runs
    // on every http(s) page — the reading-mode button on detected articles and
    // the backtick search menu — and WXT adds its `content_scripts` entry.
    //
    // The article panel is `reader.html` framed over the page the reader is
    // on (src/reader/panel.ts), and a web page may only frame an extension
    // page listed here. It grants no access to any site — it only lets the
    // panel's page load inside one. Its scripts and styles are loaded by the
    // panel itself, from the extension's own origin, so need no entry.
    web_accessible_resources:
      manifestVersion === 2
        ? ['reader.html']
        : [{ resources: ['reader.html'], matches: ['http://*/*', 'https://*/*'] }],
    // The deployments the reuse check, sign-in and account-backed AI may call
    // (see the Options page), plus the model providers above.
    host_permissions: [
      'https://debate-ai.com/*',
      'http://localhost:3000/*',
      // qwksearch's extract-webpage endpoint, which reading mode sends a URL
      // to for PDFs, and for pages and videos it can't read from the tab
      // (src/article/remote.ts).
      'https://qwksearch.com/*',
      ...AI_PROVIDER_HOSTS,
    ],
    content_security_policy: {
      extension_pages:
        "script-src 'self'; object-src 'self'; frame-src 'self' https://www.youtube.com https://debate-ai.com;",
    },
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
