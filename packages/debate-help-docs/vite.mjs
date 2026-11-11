/**
 * @file vite.mjs
 * @description The Vite plugin that compiles these docs, for the web app's
 * `vite.config.ts`.
 *
 * The docs are rendered by the web app (it mounts `routes/` under
 * `app/docs`), so it is the app's build that has to turn `content/docs` into
 * modules. That is fumadocs-mdx's Vite plugin, pointed at this package's
 * `source.config.ts` and writing its generated collections to this package's
 * `.source/` — where `lib/fumadocs/source.tsx` imports them from — rather than
 * at the app's root, which is where it would look by default.
 *
 * Plain JavaScript because Vite loads its config's workspace imports with no
 * TypeScript step of their own.
 *
 * @module @debate-ai/help-docs/vite
 */
import mdx from 'fumadocs-mdx/vite';
import { fileURLToPath } from 'node:url';
import { runnerImport } from 'vite';

/** @returns {import('vite').PluginOption} */
export function helpDocsMdx() {
  return mdx(undefined, {
    configPath: fileURLToPath(new URL('./source.config.ts', import.meta.url)),
    outDir: fileURLToPath(new URL('./.source', import.meta.url)),
  });
}

const CODE_GRAPH_ID = 'virtual:debate-code-graph';
const PACKAGES_ROOT = fileURLToPath(new URL('../', import.meta.url));

/**
 * The dev docs' package code graphs (`components/code-graph`).
 *
 * code-tree-graph scans the filesystem in a server component on every
 * render; the Worker has no filesystem, so this plugin does the scan at build
 * time instead (`lib/code-graph`, loaded through Vite's module runner because
 * it is TypeScript). `virtual:debate-code-graph` exports one loader per
 * package, each a dynamic import of `virtual:debate-code-graph/<dir>`, whose
 * module is that package's file tree as JSON. Only the client build gets real
 * loaders, so the trees (~6 MB together) ship as browser chunks fetched when a
 * dev-docs package page opens, never into the Worker bundle.
 *
 * @returns {import('vite').Plugin}
 */
export function devDocsCodeGraph() {
  /** @type {Promise<any> | undefined} */
  let scanner;
  const loadScanner = () =>
    (scanner ??= runnerImport(fileURLToPath(new URL('./lib/code-graph/index.ts', import.meta.url)), {
      configFile: false,
      logLevel: 'error',
    }).then((r) => r.module));

  return {
    name: 'debate-help-docs:code-graph',
    // Hook filters, so the bundler only calls these for our ids rather than
    // for every module in the app.
    resolveId: {
      filter: { id: /^virtual:debate-code-graph(\/|$)/ },
      handler(id) {
        return `\0${id}`;
      },
    },
    load: {
      filter: { id: /^\0virtual:debate-code-graph(\/|$)/ },
      async handler(id) {
        const isClient = this.environment?.config.consumer === 'client';
        if (id === `\0${CODE_GRAPH_ID}`) {
          if (!isClient) return 'export const codeGraphLoaders = {};';
          const { listCodeGraphPackages } = await loadScanner();
          const entries = listCodeGraphPackages(PACKAGES_ROOT).map(
            (/** @type {{ dir: string }} */ p) =>
              `  ${JSON.stringify(p.dir)}: () => import(${JSON.stringify(`${CODE_GRAPH_ID}/${p.dir}`)}),`,
          );
          return `export const codeGraphLoaders = {\n${entries.join('\n')}\n};`;
        }
        const dir = id.slice(`\0${CODE_GRAPH_ID}/`.length);
        const { listCodeGraphPackages, scanPackage } = await loadScanner();
        if (!listCodeGraphPackages(PACKAGES_ROOT).some((/** @type {{ dir: string }} */ p) => p.dir === dir)) {
          return 'export default [];';
        }
        const tree = scanPackage(PACKAGES_ROOT, dir);
        // JSON.parse of a string literal parses faster than the same object literal.
        return `export default JSON.parse(${JSON.stringify(JSON.stringify(tree))});`;
      },
    },
  };
}
