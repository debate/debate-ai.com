import { createServer } from 'vite';
import mdx from 'fumadocs-mdx/vite';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';

const root = process.cwd() + '/content/docs';
const files = [];
(function walk(d){ for (const e of fs.readdirSync(d, { withFileTypes: true })) { if (e.name === '.DS_Store') continue; const p = d + '/' + e.name; if (e.isDirectory()) walk(p); else if (/\.mdx?$/.test(e.name)) files.push(p); } })(root + '/features/tournaments-admin');

const server = await createServer({
  configFile: false, root: process.cwd(), logLevel: 'silent',
  plugins: [mdx(undefined, { configPath: fileURLToPath(new URL('./source.config.ts', import.meta.url)), outDir: fileURLToPath(new URL('./.source', import.meta.url)) })],
  server: { middlewareMode: true, hmr: false }, optimizeDeps: { noDiscovery: true },
});
await server.pluginContainer.buildStart({});
const { source } = await server.ssrLoadModule('/lib/fumadocs/source.tsx');

const byPath = new Map(source.getPages().map((p) => [p.path, p]));
console.log('sample paths', [...byPath.keys()].slice(0, 3));
const faq = byPath.get('features/tournaments-admin/Overview/1-faq.md');
console.log('faq page', faq.url, faq.slugs, faq.path);
console.log('getPageByHref(./x) ->', source.getPageByHref('./Overview/1-faq', { dir: 'features/tournaments-admin/Overview/1-faq.md' }));
console.log('resolveHref(overview/faq):', source.resolveHref('overview/faq', faq));
console.log('resolveHref(../Administration/registration):', source.resolveHref('../Administration/registration', faq));
await server.close();
