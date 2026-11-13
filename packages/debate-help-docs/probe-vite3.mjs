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
const source = await server.ssrLoadModule('/lib/fumadocs/source.tsx');
const tree = source.source.pageTree;
function walk(n, d = 0) {
  if (n.type === 'folder') {
    console.log('  '.repeat(d) + `[F] ${JSON.stringify(n.name)} index=${n.index?.url ?? '-'} desc=${JSON.stringify(n.description)}`);
    for (const c of n.children) walk(c, d + 1);
  } else if (n.type === 'page') console.log('  '.repeat(d) + `- ${JSON.stringify(n.name)} => ${n.url}`);
  else console.log('  '.repeat(d) + `--- ${n.name}`);
}
for (const c of tree.children) walk(c);
const pages = source.source.getPages();
console.log('\nURLs under tournaments-admin:');
for (const p of pages) if (p.url.includes('tournaments-admin')) console.log(p.url);
await server.close();
