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
const admin = find(tree, (n) => n.type === 'folder' && n.name === 'Tournament Admin');
function walk(n, d = 0) {
  const label = n.type === 'folder' ? `[F] ${JSON.stringify(n.name)} index=${n.index?.url ?? '-'} icon=${n.icon ? 'yes' : 'NO'} desc=${JSON.stringify(n.description)}`
    : n.type === 'page' ? `- ${JSON.stringify(n.name)} => ${n.url}` : `--- ${n.name}`;
  console.log('  '.repeat(d) + label);
  if (n.type === 'folder') for (const c of n.children) walk(c, d + 1);
}
walk(admin);
console.log('\nfeatures folder name check:', tree.children.map(c => `${c.type}:${c.name}`).join(', '));
await server.close();
