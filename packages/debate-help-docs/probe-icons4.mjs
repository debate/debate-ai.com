import { createServer } from 'vite';
import mdx from 'fumadocs-mdx/vite';
import { fileURLToPath } from 'node:url';

const server = await createServer({
  configFile: false, root: process.cwd(), logLevel: 'silent',
  plugins: [mdx(undefined, { configPath: fileURLToPath(new URL('./source.config.ts', import.meta.url)), outDir: fileURLToPath(new URL('./.source', import.meta.url)) })],
  server: { middlewareMode: true, hmr: false }, optimizeDeps: { noDiscovery: true },
});
await server.pluginContainer.buildStart({});
const { source } = await server.ssrLoadModule('/lib/fumadocs/source.tsx');
const tree = source.pageTree;
function find(n, pred) {
  if (pred(n)) return n;
  if (n.type === 'folder') for (const c of n.children) { const r = find(c, pred); if (r) return r; }
}
const feat = find(tree, (n) => n.type === 'folder' && n.name === 'Features');
console.log('Features children:');
for (const c of feat.children) console.log(' ', c.type, JSON.stringify(c.name), 'url=', c.url ?? c.index?.url, 'icon=', c.icon ? 'ok' : c.icon);
const admin = feat.children.find((c) => c.name === 'Tournament Admin');
function walk(n, d = 0) {
  const label = n.type === 'folder' ? `[F] ${JSON.stringify(n.name)} index=${n.index?.url ?? '-'} icon=${n.icon ? 'yes' : 'NO'}` : `- ${JSON.stringify(n.name)} => ${n.url}`;
  console.log('  '.repeat(d) + label);
  if (n.type === 'folder') for (const c of n.children) walk(c, d + 1);
}
console.log('\nTournament Admin subtree:');
walk(admin);
await server.close();
