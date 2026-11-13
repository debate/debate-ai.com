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

let total = 0;
const broken = [];
for (const file of files) {
  const rel = file.slice(root.length + 1);
  const raw = fs.readFileSync(file, 'utf8');
  for (const m of raw.matchAll(/\[([^\]]*)\]\(([^)\s]+)\)/g)) {
    const href = m[2];
    if (/^(https?:|mailto:|#|\/uploads)/.test(href)) continue;
    total++;
    const clean = href.split('#')[0];
    const page = source.getPageByHref(clean, { dir: rel.split('/').slice(0, -1).join('/') });
    if (page) continue;
    // MDX relative to the document folder
    const dir = rel.split('/').slice(0, -1);
    const doc = source.getPageByHref('./' + [...dir, clean].join('/'), { dir: '.' });
    if (doc) continue;
    broken.push(`${rel}  ->  ${href}`);
  }
}
console.log(`checked ${total} links, broken ${broken.length}`);
console.log(broken.join('\n'));
await server.close();
