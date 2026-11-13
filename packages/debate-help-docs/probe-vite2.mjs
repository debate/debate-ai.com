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
const { docs } = await server.ssrLoadModule('/.source/server.ts');
const pages = docs.docs;
const metas = docs.meta;
const adminPages = pages.filter((p) => p.info.path.startsWith('features/tournaments-admin'));
console.log('total pages', pages.length, 'admin pages', adminPages.length, 'metas', metas.length);
for (const p of adminPages.slice(0, 3)) {
  console.log('page', p.info.path, JSON.stringify(p.data), 'slugs', JSON.stringify(p.slugs));
}
const adminMetas = metas.filter((m) => m.info.path.startsWith('features/tournaments-admin'));
for (const m of adminMetas) console.log('meta', m.info.path, JSON.stringify(m.data));
await server.close();
