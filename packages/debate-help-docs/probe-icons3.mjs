import { createServer } from 'vite';
import mdx from 'fumadocs-mdx/vite';
import { fileURLToPath } from 'node:url';
import { icons } from 'lucide-react';

const server = await createServer({
  configFile: false, root: process.cwd(), logLevel: 'silent',
  plugins: [mdx(undefined, { configPath: fileURLToPath(new URL('./source.config.ts', import.meta.url)), outDir: fileURLToPath(new URL('./.source', import.meta.url)) })],
  server: { middlewareMode: true, hmr: false }, optimizeDeps: { noDiscovery: true },
});
await server.pluginContainer.buildStart({});
const { source } = await server.ssrLoadModule('/lib/fumadocs/source.tsx');
const tree = source.pageTree;
const rows = [];
(function walk(n, trail) {
  if (n.type === 'separator') return;
  rows.push({ name: n.name, type: n.type, icon: n.icon, trail });
  if (n.type === 'folder') for (const c of n.children) walk(c, [...trail, n.name]);
})(tree, []);
const bad = rows.filter((r) => r.type === 'folder' && r.icon == null && r.trail.length > 0);
console.log('folders without icon:');
for (const r of bad) console.log(' ', r.trail.join(' / '));
console.log('\nadmin subtree:');
for (const r of rows) if (r.trail.join('/').includes('tournaments-admin') || r.trail.length === 0) console.log(r.type, JSON.stringify(r.trail), JSON.stringify(r.name), r.icon ? 'icon-ok' : 'NO-ICON');
console.log('\nAdmin in lucide?', 'Admin' in icons, 'Scale?', 'Scale' in icons, 'Scales?', 'Scales' in icons, 'CircleHelp?', 'CircleHelp' in icons, 'Question?', 'Question' in icons);
console.log('candidate admin icons', Object.keys(icons).filter(k => /shield|administrator|user-cog|settings|clipboard|list-checks|table|layout-dashboard|gauge/i.test(k)).slice(0,20));
await server.close();
