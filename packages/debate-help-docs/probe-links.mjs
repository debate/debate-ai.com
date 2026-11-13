import { createServer } from 'vite';
import mdx from 'fumadocs-mdx/vite';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';

const root = process.cwd() + '/content/docs';
const files = [];
(function walk(d){ for (const e of fs.readdirSync(d, { withFileTypes: true })) { if (e.name === '.DS_Store') continue; const p = d + '/' + e.name; if (e.isDirectory()) walk(p); else if (/\.mdx?$/.test(e.name)) files.push(p); } })(root + '/features/tournaments-admin');

const server = await createServer({
  configFile: false, root: process.cwd(), logLevel: 'silent',
  plugins: [mdx(undefined, { configPath: fileURLToPath(new URL('./source.config.ts', import.meta.url)), outDir: fileURLToPath(new URL('./.source', import.meta.url)) })],
  server: { middlewareMode: true, hmr: false }, optimizeDeps: { noDiscovery: true },
});
await server.pluginContainer.buildStart({});
const { source } = await server.ssrLoadModule('/lib/fumadocs/source.tsx');

const urls = new Set(source.getPages().map((p) => p.url));
const byPath = new Map(source.getPages().map((p) => [p.path, p]));

let bad = 0, total = 0;
const report = [];
for (const file of files) {
  const rel = file.slice(root.length + 1);
  const raw = fs.readFileSync(file, 'utf8');
  const links = [...raw.matchAll(/\[([^\]]*)\]\(([^)\s]+)\)/g)].map((m) => ({ text: m[1], href: m[2] }));
  const page = byPath.get(rel);
  for (const { text, href } of links) {
    if (/^(https?:|mailto:|#|\/uploads)/.test(href)) continue;
    total++;
    const clean = href.split('#')[0];
    if (!clean) continue;
    let target;
    if (clean.startsWith('/')) {
      target = clean;
    } else {
      // relative to the page's folder, like fumadocs resolveHref
      const dir = rel.split('/').slice(0, -1);
      const segs = [...dir];
      for (const part of clean.split('/')) {
        if (part === '.') continue;
        else if (part === '..') segs.pop();
        else segs.push(part);
      }
      const last = segs.pop();
      const slug = last.replace(/\.mdx?$/, '');
      const candidateDir = segs.join('/');
      const candidates = [ `${candidateDir}/${slug}.md`, `${candidateDir}/${slug}.mdx`, `${candidateDir}/${slug}/index.md`, `${candidateDir}/${slug}/index.mdx` ];
      target = candidates.map((c) => '/' + c.replace(/^features\//, 'features/')).find((c) => byPath.has(c.replace(/^\//, '')));
      if (!target) {
        // fall back: match any page whose path ends with the slug
        const matches = [...byPath.keys()].filter((k) => k.endsWith(`/${slug}.md`) || k.endsWith(`/${slug}.mdx`));
        if (matches.length === 1) target = '/' + matches[0];
      }
    }
    const url = target ? byPath.get(target.replace(/^\//, ''))?.url : undefined;
    if (!url || !urls.has(url)) { bad++; report.push(`${rel}  ->  ${href}   [${text}]`); }
  }
}
console.log(`checked ${total} internal links, ${bad} broken`);
for (const r of report) console.log(' BROKEN', r);
await server.close();
