/**
 * @file section-pages.ts
 * @description The pages of a docs page's section (its folder), in sidebar
 * order, for reading mode (`components/guides/reading-mode.tsx`).
 */
import type { Node } from 'fumadocs-core/page-tree';
import { source } from './source';

/** Every page URL in `nodes`, in tree order (a folder's index page first). */
export function treePageUrls(nodes: Node[]): string[] {
  const urls: string[] = [];
  for (const node of nodes) {
    if (node.type === 'page') urls.push(node.url);
    else if (node.type === 'folder') {
      if (node.index) urls.push(node.index.url);
      urls.push(...treePageUrls(node.children));
    }
  }
  return urls;
}

/** The folder of a content path. */
function folderOf(path: string): string {
  return path.replace(/\\/g, '/').replace(/\/[^/]*$/, '');
}

/** The title of the section's index page (the paper's title), if it has one. */
export function sectionTitle(path: string): string | undefined {
  const dir = folderOf(path);
  const index = source.getPages().find((page) => page.path.replace(/\\/g, '/') === `${dir}/index.mdx`);
  return index?.data.title;
}

/**
 * The pages in the same folder as the page at content path `path` (and any
 * folders below it), in sidebar order, with their titles.
 */
export function sectionPages(path: string): { url: string; title: string }[] {
  const dir = folderOf(path);
  const inSection = new Map(
    source
      .getPages()
      .filter((page) => page.path.replace(/\\/g, '/').startsWith(`${dir}/`))
      .map((page) => [page.url, String(page.data.title ?? page.url)]),
  );
  const ordered = [...new Set(treePageUrls(source.pageTree.children))].filter((url) => inSection.has(url));
  // Pages the sidebar leaves out still belong to the section; they go last.
  for (const url of inSection.keys()) if (!ordered.includes(url)) ordered.push(url);
  return ordered.map((url) => ({ url, title: inSection.get(url)! }));
}
