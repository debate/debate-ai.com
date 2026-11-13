import { createServer } from 'vite';
import mdx from 'fumadocs-mdx/vite';
import { fileURLToPath } from 'node:url';

const server = await createServer({
  configFile: false,
  root: process.cwd(),
  logLevel: 'error',
  plugins: [mdx(undefined, { configPath: fileURLToPath(new URL('./source.config.ts', import.meta.url)), outDir: fileURLToPath(new URL('./.source', import.meta.url)) })],
  server: { middlewareMode: true, hmr: false },
  optimizeDeps: { noDiscovery: true },
});
await server.pluginContainer.buildStart({});
const { source } = await server.ssrLoadModule('/lib/fumadocs/source.tsx');
const tree = source.pageTree;
function find(n, url) {
  if (n.type === 'page') return n.url === url ? n : undefined;
  if (n.type === 'folder') {
    if (n.index?.url === url) return n;
    for (const c of n.children) { const r = find(c, url); if (r) return r; }
  }
}
function walk(n, d = 0) {
  if (n.type === 'folder') {
    console.log('  '.repeat(d) + `[F] ${JSON.stringify(n.name)} root=${!!n.root} collapsible=${n.collapsible} defaultOpen=${n.defaultOpen} icon=${JSON.stringify(n.icon)} index=${n.index?.url ?? '-'}`);
    for (const c of n.children) walk(c, d + 1);
  } else if (n.type === 'page') console.log('  '.repeat(d) + `- ${JSON.stringify(n.name)} => ${n.url}`);
  else console.log('  '.repeat(d) + `--- ${n.name}`);
}
const admin = find(tree, '/docs/features/tournaments-admin');
walk(admin);
console.log('\n--- index page node:', JSON.stringify(admin.index));
const all = source.getPages();
const inTree = new Set();
(function c(n){ if(n.type==='page') inTree.add(n.url); if(n.type==='folder'){ if(n.index) inTree.add(n.index.url); n.children.forEach(c);} })(tree);
console.log('\nadmin pages missing from tree:');
for (const p of all) if (p.url.startsWith('/docs/features/tournaments-admin') && !inTree.has(p.url)) console.log(' ', p.url);
await server.close();
