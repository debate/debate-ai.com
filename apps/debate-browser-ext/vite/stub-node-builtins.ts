import type { Plugin } from 'vite';

/**
 * `api2client` (pulled in by `qwksearch-api-client`) ships its Node-only
 * codegen (`generate-*.js`: spawn, fs, createRequire, …) as a static import
 * of its browser entry. Vite externalizes `node:*` to an empty module for the
 * browser, and Rollup then fails on the named imports (`createRequire` is not
 * exported by "__vite-browser-external"). The codegen never runs in the
 * extension, so for importers inside that package each `node:*` import
 * resolves to a stub whose exports throw if called.
 */
const PACKAGES = /[\\/]node_modules[\\/](?:\.bun[\\/][^\\/]+[\\/]node_modules[\\/])?api2client[\\/]/;
const PREFIX = '\0stub-node:';

export function stubNodeBuiltins(): Plugin {
  return {
    name: 'stub-node-builtins',
    enforce: 'pre',
    resolveId(source, importer) {
      if (source.startsWith('node:') && importer && PACKAGES.test(importer)) return PREFIX + source;
      return null;
    },
    load(id) {
      if (!id.startsWith(PREFIX)) return null;
      const name = id.slice(PREFIX.length);
      const names = ['spawn', 'readFileSync', 'existsSync', 'writeFileSync', 'readdirSync', 'statSync',
        'createRequire', 'resolve', 'join', 'pathToFileURL'];
      const fn = `() => { throw new Error(${JSON.stringify(`${name} is not available in the browser`)}); }`;
      return `${names.map((n) => `export const ${n} = ${fn};`).join('\n')}\nexport default {};\n`;
    },
  };
}
