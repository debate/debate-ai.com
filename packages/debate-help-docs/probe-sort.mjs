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
const learn = tree.children.find((c) => c.name === 'Learn');
const sorted = learn.children.map((c) => c.name ?? c.url);
console.log('Learn children order:', JSON.stringify(sorted, null, 0));
console.log('is sorted?', JSON.stringify(sorted) === JSON.stringify([...sorted].sort((a, b) => a.localeCompare(b))));
const cp = learn.children.find((c) => c.name === 'Counterplans');
console.log('counterplans kids', cp?.children?.map((c) => c.name).slice(0, 12));
const crit = learn.children.find((c) => c.name === 'Critiques');
console.log('critiques kids', crit?.children?.map((c) => c.name).slice(0, 12));
await server.close();
