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
const mod = await server.ssrLoadModule('/content/docs/features/tournaments-admin/meta.json?collection=docs');
console.log('META', JSON.stringify(mod.default));
const idx = await server.ssrLoadModule('/content/docs/features/tournaments-admin/index.md?collection=docs&only=frontmatter');
console.log('HEAD', JSON.stringify(idx.frontmatter));
const body = await server.ssrLoadModule('/content/docs/features/tournaments-admin/Overview/1-faq.md?collection=docs');
console.log('BODY keys', Object.keys(body).slice(0,8));
await server.close();
