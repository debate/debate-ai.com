import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Plugin } from 'vite';

/**
 * Chrome Web Store rejects a Manifest V3 item whose code can load a script
 * from anywhere but the extension itself ("Including remotely hosted code").
 * Our own code never does, but the libraries `debate-webview` bundles do:
 * the REASON editor pulls mermaid, KaTeX and jsPDF from jsDelivr/cdnjs on
 * demand, and react-player pulls each video host's SDK (Cast, Wistia, …).
 * The reviewer's scan flags the URL string in the shipped chunk, whether or
 * not that path ever runs.
 *
 * So every remote `.js` URL in the output is rewritten to an extension-local
 * path before it is written:
 *
 * - An npm CDN URL (jsDelivr, unpkg, cdnjs) names a package and a file in
 *   it. That file is copied out of the locally installed package into
 *   `vendor/<pkg>/<file>` and the URL becomes `/vendor/<pkg>/<file>`, so the
 *   feature keeps working, loaded from the extension's own origin.
 * - Anything else (a vendor SDK with no npm build, or an npm package that is
 *   not installed) becomes `/vendor/unavailable/<name>.js`, a path that is
 *   never emitted: the script fails to load, the library's own error path
 *   runs, and nothing is fetched from the network.
 */

/** Characters that end a URL inside a JS string/template literal. */
const URL_END = `\\s'"\`<>()\\\\`;

/** `https://cdn.jsdelivr.net/npm/<pkg>@<ver>/<file>.js`, and unpkg's same shape. */
const NPM_CDN = new RegExp(
  `https?://(?:cdn\\.jsdelivr\\.net/npm|unpkg\\.com)/((?:@[\\w.-]+/)?[\\w.-]+)@[^/${URL_END}]+/([^?#${URL_END}]+?\\.m?js)(?![\\w.-])(?:[?#][^${URL_END}]*)?`,
  'g'
);

/** `https://cdnjs.cloudflare.com/ajax/libs/<lib>/<ver>/<file>.js`. */
const CDNJS = new RegExp(
  `https?://cdnjs\\.cloudflare\\.com/ajax/libs/([\\w.-]+)/[^/${URL_END}]+/([^?#${URL_END}]+?\\.m?js)(?![\\w.-])(?:[?#][^${URL_END}]*)?`,
  'g'
);

/** Any other remote script: a `.js`/`.mjs` path on some host, query optional. */
const ANY_REMOTE_SCRIPT = new RegExp(
  `https?://[^/${URL_END}]+/[^?#${URL_END}]*?\\.m?js(?![\\w.-])(?:[?#][^${URL_END}]*)?`,
  'g'
);

/** Finds `<file>` inside the installed npm package `<pkg>`, or `null`. */
export type PackageFileResolver = (pkg: string, file: string) => string | null;

export interface RewriteResult {
  code: string;
  /** Local copies to emit: published path → absolute source file. */
  vendored: Map<string, string>;
  /** Remote URLs that had no local copy and were disabled. */
  disabled: string[];
}

function unavailablePath(url: string): string {
  const name = url
    .replace(/^https?:\/\//, '')
    .replace(/[?#].*$/, '')
    .replace(/[^\w.-]+/g, '_')
    .replace(/\.m?js$/, '');
  return `/vendor/unavailable/${name}.js`;
}

/** Rewrites every remote script URL in `code` to an extension-local path. */
export function rewriteRemoteScripts(code: string, resolveFile: PackageFileResolver): RewriteResult {
  const vendored = new Map<string, string>();
  const disabled: string[] = [];

  const vendor = (url: string, pkg: string, candidates: string[]): string => {
    for (const file of candidates) {
      const source = resolveFile(pkg, file);
      if (source) {
        const published = `vendor/${pkg}/${file}`;
        vendored.set(published, source);
        return `/${published}`;
      }
    }
    disabled.push(url);
    return unavailablePath(url);
  };

  let out = code.replace(NPM_CDN, (url, pkg: string, file: string) => vendor(url, pkg, [file]));
  out = out.replace(CDNJS, (url, lib: string, file: string) =>
    vendor(url, lib, [file, `dist/${file}`])
  );
  out = out.replace(ANY_REMOTE_SCRIPT, (url) => {
    disabled.push(url);
    return unavailablePath(url);
  });

  return { code: out, vendored, disabled };
}

/**
 * Looks a package file up in the monorepo's installs: the given workspace
 * directories' `node_modules`, the root's, and bun's isolated store
 * (`node_modules/.bun/<pkg>@<ver>/node_modules/<pkg>`), newest version first.
 */
export function createPackageFileResolver(repoRoot: string, workspaceDirs: string[]): PackageFileResolver {
  const bunStore = join(repoRoot, 'node_modules/.bun');
  const storeEntries = existsSync(bunStore) ? readdirSync(bunStore) : [];
  const safe = (p: string) => !p.split('/').includes('..');

  return (pkg, file) => {
    if (!safe(pkg) || !safe(file)) return null;
    const direct = [...workspaceDirs, repoRoot].map((dir) => join(dir, 'node_modules', pkg, file));
    const storePrefix = `${pkg.replace('/', '+')}@`;
    const fromStore = storeEntries
      .filter((entry) => entry.startsWith(storePrefix))
      .sort((a, b) => b.localeCompare(a, undefined, { numeric: true }))
      .map((entry) => join(bunStore, entry, 'node_modules', pkg, file));
    return [...direct, ...fromStore].find((candidate) => existsSync(candidate)) ?? null;
  };
}

/** The Vite plugin: rewrites each output chunk and emits the vendored files. */
export function noRemoteCode(resolveFile: PackageFileResolver): Plugin {
  let emitted = new Set<string>();
  let warned = new Set<string>();

  return {
    name: 'debate-ext:no-remote-code',
    apply: 'build',
    enforce: 'post',
    renderStart() {
      emitted = new Set();
      warned = new Set();
    },
    renderChunk(code, chunk) {
      const result = rewriteRemoteScripts(code, resolveFile);
      if (result.code === code) return null;

      for (const [fileName, source] of result.vendored) {
        if (emitted.has(fileName)) continue;
        emitted.add(fileName);
        this.emitFile({ type: 'asset', fileName, source: readFileSync(source) });
      }
      for (const url of result.disabled) {
        if (warned.has(url)) continue;
        warned.add(url);
        this.warn(`remote script disabled in ${chunk.fileName} (no local copy): ${url}`);
      }
      return { code: result.code, map: null };
    },
  };
}
