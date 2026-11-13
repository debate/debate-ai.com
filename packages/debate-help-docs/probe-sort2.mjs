import { loader } from 'fumadocs-core/source';
const metas = [{ info: { path: 'features/zzz/meta.json' }, title: 'Z', pages: ['b-page', 'a-page', '10-ten', '2-two'] }];
const pages = ['b-page', 'a-page', '10-ten', '2-two'].map((n) => ({ info: { path: `features/zzz/${n}.mdx` }, slugs: ['features', 'zzz', n], data: { title: n } }));
const l = loader({ baseUrl: '/docs', source: { files: [
  ...pages.map((p) => ({ type: 'page', path: p.info.path, absolutePath: p.info.path, data: p.data, slugs: p.slugs })),
  ...metas.map((m) => ({ type: 'meta', path: m.info.path, absolutePath: m.info.path, data: m })),
] } });
const z = l.pageTree.children.find((c) => c.name === 'Z');
console.log('pages array order:', JSON.stringify(z.children.map((c) => c.name)));
const rest = { ...metas[0], pages: ['...'] };
const l2 = loader({ baseUrl: '/docs', source: { files: [
  ...pages.map((p) => ({ type: 'page', path: p.info.path, absolutePath: p.info.path, data: p.data, slugs: p.slugs })),
  { type: 'meta', path: 'features/zzz/meta.json', absolutePath: 'x', data: rest },
] } });
const z2 = l2.pageTree.children.find((c) => c.name === 'Z');
console.log('rest "..." order:', JSON.stringify(z2.children.map((c) => c.name)));
