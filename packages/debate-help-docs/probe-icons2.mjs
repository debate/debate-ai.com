import { createServer } from 'vite';
import mdx from 'fumadocs-mdx/vite';
import { fileURLToPath } from 'node:url';

const server = await createServer({
  configFile: false,
  root: process.cwd(),
  logLevel: 'silent',
  plugins: [mdx(undefined, { configPath: fileURLToPath(new URL('./source.config.ts', import.meta.url)), outDir: fileURLToPath(new URL('./.source', import.meta.url)) })],
  server: { middlewareMode: true, hmr: false },
  optimizeDeps: { noDiscovery: true },
});
await server.pluginContainer.buildStart({});
const { source } = await server.ssrLoadModule('/lib/fumadocs/source.tsx');
const tree = source.pageTree;
const missing = [];
(function walk(n, path) {
  if (n.type === 'separator') return;
  if (n.icon !== undefined && (n.icon === null || (typeof n.icon !== 'object' && typeof n.icon !== 'function'))) missing.push([n.name, n.icon, path]);
  if (n.type === 'folder') for (const c of n.children) walk(c, path + '/' + (c.name ?? ''));
  else if (n.type === 'page') walk(c = n, path);
})(tree, '');
console.log('missing count', missing.length);
for (const m of missing) console.log(JSON.stringify(m[0]), '<-', JSON.stringify(m[1]), 'at', m[2]);
await server.close();
