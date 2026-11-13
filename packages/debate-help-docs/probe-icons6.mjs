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
function find(n, url) {
  if (n.type === 'page') return n.url === url ? n : undefined;
  if (n.type === 'folder') {
    if (n.index?.url === url) return n;
    for (const c of n.children) { const r = find(c, url); if (r) return r; }
  }
}
const admin = find(tree, '/docs/features/tournaments-admin');
function walk(n, d = 0) {
  const label = n.type === 'folder' ? `[F] ${JSON.stringify(n.name)} index=${n.index?.url ?? '-'} icon=${n.icon ? 'yes' : 'NO'} desc=${JSON.stringify(n.description)}`
    : n.type === 'page' ? `- ${JSON.stringify(n.name)} => ${n.url}` : `--- ${n.name}`;
  console.log('  '.repeat(d) + label);
  if (n.type === 'folder') for (const c of n.children) walk(c, d + 1);
}
if (!admin) { console.log('admin not found'); } else walk(admin);
console.log('\ntop-level:', tree.children.map((c) => `${c.type}:${JSON.stringify(c.name)}`).join(', '));
await server.close();
