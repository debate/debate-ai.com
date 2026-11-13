import { createServer } from 'vite';
import mdx from 'fumadocs-mdx/vite';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';

const server = await createServer({
  configFile: false, root: process.cwd(), logLevel: 'silent',
  plugins: [mdx(undefined, { configPath: fileURLToPath(new URL('./source.config.ts', import.meta.url)), outDir: fileURLToPath(new URL('./.source', import.meta.url)) })],
  server: { middlewareMode: true, hmr: false }, optimizeDeps: { noDiscovery: true },
});
await server.pluginContainer.buildStart({});
const { source } = await server.ssrLoadModule('/lib/fumadocs/source.tsx');
const p = source.getPages().find((x) => x.path === 'features/rounds/index.mdx');
console.log('page', p?.url, p?.slugs, p?.path);
for (const href of ['./ai-versus-rounds', 'ai-versus-rounds', '../rounds/practice-tools', '/docs/features/rounds/practice-tools']) {
  const r = source.getPageByHref(href, { dir: 'features/rounds/index.mdx' });
  console.log(JSON.stringify(href), '=>', r?.page?.url ?? r?.url ?? 'MISS');
}
const root = process.cwd() + '/content/docs';
const all = [];
(function walk(d){ for (const e of fs.readdirSync(d, { withFileTypes: true })) { if (e.name === '.DS_Store') continue; const f = d + '/' + e.name; if (e.isDirectory()) walk(f); else if (/\.mdx?$/.test(e.name)) all.push(f); } })(root + '/features/rounds');
let total = 0, broken = 0;
const examples = [];
for (const file of all) {
  const rel = file.slice(root.length + 1);
  const raw = fs.readFileSync(file, 'utf8');
  for (const m of raw.matchAll(/\[([^\]]*)\]\(([^)\s]+)\)/g)) {
    const href = m[2];
    if (/^(https?:|mailto:|#|\/uploads)/.test(href)) continue;
    total++;
    const r = source.getPageByHref(href.split('#')[0], { dir: rel.split('/').slice(0, -1).join('/') });
    if (!r) { broken++; if (examples.length < 8) examples.push(`${rel} -> ${href}`); }
  }
}
console.log(`rounds: ${total} links, ${broken} broken`);
console.log(examples.join('\n'));
await server.close();
