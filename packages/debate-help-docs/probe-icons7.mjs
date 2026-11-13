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
const feat = tree.children.find((c) => c.name === 'Features');
console.log('Features:', JSON.stringify({ name: feat.name, index: feat.index?.url, root: feat.root }));
console.log('children:');
for (const c of feat.children) console.log(' ', c.type, JSON.stringify(c.name), c.url ?? c.index?.url);
await server.close();
