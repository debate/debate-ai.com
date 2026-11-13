import { createServer } from 'vite';
import mdx from 'fumadocs-mdx/vite';
import { fileURLToPath } from 'node:url';

const server = await createServer({
  configFile: false,
  root: process.cwd(),
  logLevel: 'info',
  customLogger: { info: (m) => { if (String(m).includes('icon')) console.log(m); }, warn(){}, error: console.error, warnOnce(){}, clearScreen(){}, hasErrorLogged(){return false;}, hasWarned:false },
  plugins: [mdx(undefined, { configPath: fileURLToPath(new URL('./source.config.ts', import.meta.url)), outDir: fileURLToPath(new URL('./.source', import.meta.url)) })],
  server: { middlewareMode: true, hmr: false },
  optimizeDeps: { noDiscovery: true },
});
await server.pluginContainer.buildStart({});
const { source } = await server.ssrLoadModule('/lib/fumadocs/source.tsx');
const tree = source.pageTree;
const icons = new Map();
(function walk(n, trail) {
  if (n.type === 'separator') return;
  if (n.icon) {
    const kind = typeof n.icon === 'object' ? 'component' : 'missing';
    if (kind === 'missing') {
      if (!icons.has(n.icon)) icons.set(n.icon, []);
      icons.get(n.icon).push(n.type === 'page' ? n.url : `[folder] ${n.name}`);
    }
  }
  if (n.type === 'folder') n.children.forEach((c) => walk(c, trail));
})(tree, []);
for (const [icon, where] of icons) console.log('MISSING ICON', JSON.stringify(icon), where.slice(0, 4));
await server.close();
