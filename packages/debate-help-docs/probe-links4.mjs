import { dynamic } from 'fumadocs-mdx/runtime/dynamic';
import * as Config from './source.config';
import fs from 'node:fs';
const docs = await dynamic(Config, { environment: 'dynamic', root: process.cwd(), configPath: 'source.config.ts', outDir: '.source' });
const abs = process.cwd() + '/content/docs/features/tournaments-admin/index.md';
const r = await docs.docs('docs', 'content/docs', async () => ({}), [{ info: { fullPath: abs, path: 'features/tournaments-admin/index.md' }, data: {}, hash: 'x' }]);
const p = (await r.docs)[0];
const md = await p.getText('processed');
console.log(md.slice(0, 1200));
