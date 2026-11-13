import { loader } from 'fumadocs-core/source';
const names = ['b-page', 'a-page', '10-ten', '2-two'];
const pages = names.map((n) => ({ info: { path: `features/zzz/${n}.mdx` }, slugs: ['features', 'zzz', n], data: { title: n } }));
const files = [
  ...pages.map((p) => ({ type: 'page', path: p.info.path, absolutePath: p.info.path, data: p.data })),
  { type: 'meta', path: 'features/meta.json', absolutePath: 'x', data: { title: 'Features', pages: ['zzz'] } },
  { type: 'meta', path: 'features/zzz/meta.json', absolutePath: 'y', data: { title: 'Z', pages: ['b-page', 'a-page', '10-ten', '2-two'] } },
];
const l = loader({ baseUrl: '/docs', source: { files } });
const z = l.pageTree.children[0].children[0];
console.log('explicit order:', JSON.stringify(z.children.map((c) => c.name)));
const files2 = files.filter((f) => f.path !== 'features/zzz/meta.json').concat([{ type: 'meta', path: 'features/zzz/meta.json', absolutePath: 'y', data: { title: 'Z', pages: ['...'] } }]);
const l2 = loader({ baseUrl: '/docs', source: { files: files2 } });
const z2 = l2.pageTree.children[0].children[0];
console.log('rest order:', JSON.stringify(z2.children.map((c) => c.name)));
