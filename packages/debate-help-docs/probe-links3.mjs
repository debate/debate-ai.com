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
const allPages = source.getPages();
const byPath = new Map(allPages.map((p) => [p.path, p]));

let total = 0;
const broken = [];
for (const file of files) {
  const rel = file.slice(root.length + 1);
  const raw = fs.readFileSync(file, 'utf8');
  for (const m of raw.matchAll(/\[([^\]]*)\]\(([^)\s]+)\)/g)) {
    const href = m[2];
    if (/^(https?:|mailto:|#|\/uploads)/.test(href)) continue;
    total++;
    const page = byPath.get(rel);
    const resolved = source.resolveHref(href, page);
    // resolveHref only resolves ./ and ../; otherwise it returns as-is (a URL)
    if (resolved !== href) continue;
    if (href.startsWith('/') || href.startsWith('..') || href.startsWith('./')) { broken.push([rel, href, m[1]]); continue; }
    // bare slug relative to the page's own folder
    const dir = rel.split('/').slice(0, -1);
    const segs = [...dir, href];
    const c1 = segs.join('/') + '.md';
    const c2 = segs.join('/') + '.mdx';
    const target = byPath.get(c1) ?? byPath.get(c2);
    if (!target) broken.push([rel, href, m[1]]);
  }
}
console.log(`checked ${total}, broken ${broken.length}`);
for (const [f, h, t] of broken) console.log(' ', f, '->', h, '|', t.replace(/\n/g, ' '));
await server.close();
